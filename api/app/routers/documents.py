from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from app.deps import require_consent
from app.document_ai.storage import (
    DocumentRepository,
    LocalStorageBackend,
    sha256,
    update_json_path,
    utc_now,
    validate_upload,
)

router = APIRouter(
    prefix="/api/documents",
    tags=["documents"],
)

_repository = DocumentRepository()
_storage = LocalStorageBackend()
logger = logging.getLogger(__name__)


# ============================================================
# Helpers
# ============================================================


def _get_document(
    document_id: str,
) -> dict[str, Any]:

    try:
        UUID(document_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid document id",
        ) from exc

    document = _repository.get_document(
        document_id
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return document


def _write_ml2_result(
    document_id: str,
    result: dict[str, Any],
) -> None:
    """
    Persist the complete ML2 structured JSON.

    The repository remains the source used by the API,
    while this also keeps a JSON artifact for local/debug
    inspection when the repository implementation supports it.
    """

    _repository.put_result(
        document_id,
        result,
    )


def _normalise_result(
    document_id: str,
    result: dict[str, Any],
) -> dict[str, Any]:
    """
    Make sure the API always exposes the ML2 contract.

    The full structured result is preserved.
    """

    output = dict(result)

    output["document_id"] = (
        output.get(
            "document_id"
        )
        or document_id
    )

    return output


# ============================================================
# Upload
# ============================================================


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_consent)],
)
async def upload_document(
    file: UploadFile = File(...),
    patient_id: str | None = Form(
        default=None
    ),
) -> dict[str, Any]:
    """
    Upload and securely retain a document.

    Processing is intentionally separate from upload.

    Flow:

        POST /upload
            ↓
        validate
            ↓
        storage
            ↓
        document_id
            ↓
        POST /{document_id}/process
    """

    content = await file.read(
        10 * 1024 * 1024 + 1
    )

    try:
        content_type = validate_upload(
            content,
            file.content_type,
            file.filename or "",
        )

    except ValueError as exc:

        message = str(exc)

        if "10 MB" in message:
            code = 413

        elif (
            "type" in message.lower()
            or "match" in message.lower()
        ):
            code = 415

        else:
            code = 422

        raise HTTPException(
            status_code=code,
            detail=message,
        ) from exc

    document_id = uuid4()

    stored = _storage.save(
        document_id,
        content,
    )

    document = {
        "document_id": str(
            document_id
        ),
        "patient_id": patient_id,
        "original_filename": Path(
            file.filename
            or "document"
        ).name,
        "content_type": content_type,
        "size": len(content),
        "sha256": sha256(content),
        "storage_uri": stored[
            "storage_uri"
        ],
        "encryption": stored[
            "encryption"
        ],
        "created_at": utc_now(),
        "status": "uploaded",
        "error_message": None,
    }

    _repository.put_document(
        document
    )

    _repository.audit(
        str(document_id),
        "DOCUMENT_UPLOADED",
        None,
        "success",
        {
            "size": len(content),
            "content_type": content_type,
        },
    )

    return {
        "document_id": str(
            document_id
        ),
        "status": "uploaded",
        "original_document_uri": stored[
            "storage_uri"
        ],
    }


# ============================================================
# PROCESS — ML2
# ============================================================


# ============================================================
# Upload and process
# ============================================================


@router.post(
    "/upload-and-process",
    status_code=status.HTTP_200_OK,
)
async def upload_and_process_document(
    file: UploadFile = File(...),
    patient_id: str | None = Form(
        default=None
    ),
    consent: str = Depends(
        require_consent
    ),
) -> dict[str, Any]:
    """Upload and process a document in one serverless invocation.

    The separate upload and process endpoints remain available for two-step
    clients. The app uses this route because separate Vercel function
    invocations do not share temporary files.
    """

    uploaded = await upload_document(
        file=file,
        patient_id=patient_id,
    )

    return await process_document(
        document_id=uploaded["document_id"],
        consent=consent,
    )


@router.post(
    "/{document_id}/process",
    status_code=status.HTTP_200_OK,
)
async def process_document(
    document_id: str,
    consent: str = Depends(
        require_consent
    ),
) -> dict[str, Any]:
    """
    Run the complete ML2 Document AI pipeline.

    Production flow:

        Stored document
              ↓
        DocumentAIPipeline
              ↓
        Mistral OCR
              ↓
        OCR correction
              ↓
        document classification
              ↓
        clinical extraction
              ↓
        confidence scoring
              ↓
        structured ML2 JSON
              ↓
        repository
              ↓
        ML3
    """

    document = _get_document(
        document_id
    )

    # --------------------------------------------------------
    # Update processing state
    # --------------------------------------------------------

    document.update(
        {
            "status": "processing",
            "processing_started_at": utc_now(),
            "error_message": None,
        }
    )

    _repository.put_document(
        document
    )

    _repository.audit(
        document_id,
        "DOCUMENT_PROCESSING_STARTED",
        None,
        "started",
    )

    temporary_path: str | None = None

    try:

        # ====================================================
        # 1. Load original document
        # ====================================================

        plaintext = _storage.load(
            UUID(document_id)
        )

        if not plaintext:
            raise ValueError(
                "Stored document is empty"
            )

        content_type = document.get(
            "content_type",
            "",
        )

        original_filename = document.get(
            "original_filename",
            "document",
        )

        suffix = Path(
            original_filename
        ).suffix.lower()

        if not suffix:

            if content_type == "image/png":
                suffix = ".png"

            elif content_type in {
                "image/jpeg",
                "image/jpg",
            }:
                suffix = ".jpg"

            elif content_type == "application/pdf":
                suffix = ".pdf"

            else:
                suffix = ".bin"

        # ====================================================
        # 2. Write temporary processing file
        # ====================================================

        output = tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False,
        )

        output.write(
            plaintext
        )

        output.close()

        temporary_path = output.name

        # ====================================================
        # 3. Run NEW ML2 pipeline
        # ====================================================

        from app.document_ai.pipeline import DocumentAIPipeline

        pipeline = DocumentAIPipeline(
            ocr_provider=None,
            correction_provider=None,
            extraction_provider=None,
        )

        ml2_result = pipeline.process(
            temporary_path
        )

        if not isinstance(
            ml2_result,
            dict,
        ):
            raise ValueError(
                "ML2 pipeline returned an invalid result"
            )

        ml2_result = _normalise_result(
            document_id,
            ml2_result,
        )

        # ====================================================
        # 4. Extract key metadata
        # ====================================================

        source = ml2_result.get(
            "source",
            {},
        )

        confidence = ml2_result.get(
            "confidence",
            {},
        )

        provenance = ml2_result.get(
            "provenance",
            {},
        )

        ocr_confidence = confidence.get(
            "ocr",
            source.get(
                "ocr_confidence"
            ),
        )

        extraction_confidence = (
            confidence.get(
                "extraction"
            )
        )

        final_confidence = confidence.get(
            "final"
        )

        manual_review_required = bool(
            confidence.get(
                "manual_review_required",
                False,
            )
        )

        # ====================================================
        # 5. Preserve ML2 structured result
        # ====================================================

        result = {
            **ml2_result,

            "document_id": document_id,

            "status": (
                "manual_review"
                if manual_review_required
                else "completed"
            ),
        }

        # ====================================================
        # 6. Save result
        # ====================================================

        _write_ml2_result(
            document_id,
            result,
        )

        # ====================================================
        # 7. Audit
        # ====================================================

        _repository.audit(
            document_id,
            "ML2_PIPELINE_COMPLETED",
            None,
            "success",
            {
                "document_type": ml2_result.get(
                    "document_type"
                ),
                "ocr_provider": source.get(
                    "provider"
                ),
                "ocr_model": source.get(
                    "model"
                ),
                "extraction_provider": (
                    provenance.get(
                        "extraction_provider"
                    )
                ),
                "extraction_model": (
                    provenance.get(
                        "extraction_model"
                    )
                ),
                "ocr_confidence": (
                    ocr_confidence
                ),
                "extraction_confidence": (
                    extraction_confidence
                ),
                "final_confidence": (
                    final_confidence
                ),
                "manual_review_required": (
                    manual_review_required
                ),
            },
        )

        # ====================================================
        # 8. Update document record
        # ====================================================

        document.update(
            {
                "status": result[
                    "status"
                ],
                "processing_completed_at": utc_now(),

                "ocr_provider": source.get(
                    "provider"
                ),

                "ocr_model": source.get(
                    "model"
                ),

                "extraction_provider": (
                    provenance.get(
                        "extraction_provider"
                    )
                ),

                "extraction_model": (
                    provenance.get(
                        "extraction_model"
                    )
                ),

                "ocr_confidence": (
                    ocr_confidence
                ),

                "extraction_confidence": (
                    extraction_confidence
                ),

                "overall_confidence": (
                    final_confidence
                ),

                "requires_manual_review": (
                    manual_review_required
                ),
            }
        )

        _repository.put_document(
            document
        )

        # ====================================================
        # 9. Manual review audit
        # ====================================================

        if manual_review_required:

            _repository.audit(
                document_id,
                "MANUAL_REVIEW_REQUIRED",
                None,
                "pending",
                {
                    "confidence": (
                        final_confidence
                    ),
                },
            )

        # ====================================================
        # 10. API response
        # ====================================================

        return result

    # ========================================================
    # ERROR HANDLING
    # ========================================================

    except HTTPException:
        raise

    except (ModuleNotFoundError, ImportError) as exc:

        document.update(
            {
                "status": "failed",
                "error_message": f"Missing Document AI dependency: {exc.name}",
                "processing_completed_at": utc_now(),
            }
        )

        _repository.put_document(
            document
        )

        _repository.audit(
            document_id,
            "DOCUMENT_PROCESSING_FAILED",
            None,
            "failed",
            {
                "error": "missing_document_ai_dependency",
                "dependency": exc.name,
            },
        )

        missing = getattr(exc, "name", None) or str(exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "Document AI dependencies are unavailable. "
                f"Missing module: {missing}. "
                "Install the local API dependencies with: "
                "pip install -r api/requirements.txt"
            ),
        ) from exc

    except RuntimeError as exc:

        detail = str(exc)
        configuration_error = "MISTRAL_API_KEY is not configured" in detail

        document.update(
            {
                "status": "failed",
                "error_message": detail,
                "processing_completed_at": utc_now(),
            }
        )

        _repository.put_document(
            document
        )

        _repository.audit(
            document_id,
            "DOCUMENT_PROCESSING_FAILED",
            None,
            "failed",
            {
                "error": "document_ai_configuration" if configuration_error else "document_ai_runtime",
            },
        )

        raise HTTPException(
            status_code=503 if configuration_error else 502,
            detail=(
                "Document AI requires MISTRAL_API_KEY in api/.env."
                if configuration_error
                else "Document AI could not process this file. Check the API logs and provider configuration."
            ),
        ) from exc

    except Exception as exc:

        logger.exception(
            "Document processing failed for %s",
            document_id,
        )

        document.update(
            {
                "status": "failed",
                "error_message": str(
                    exc
                ),
                "processing_completed_at": utc_now(),
            }
        )

        _repository.put_document(
            document
        )

        _repository.audit(
            document_id,
            "DOCUMENT_PROCESSING_FAILED",
            None,
            "failed",
            {
                "error": str(exc)
            },
        )

        raise HTTPException(
            status_code=500,
            detail="Document processing failed",
        ) from exc

    finally:

        if temporary_path:

            try:
                Path(
                    temporary_path
                ).unlink()

            except OSError:
                pass


# ============================================================
# GET DOCUMENT
# ============================================================


@router.get(
    "/{document_id}"
)
async def get_document(
    document_id: str,
) -> dict[str, Any]:

    document = _get_document(
        document_id
    )

    document.pop(
        "error_message",
        None,
    )

    return document


# ============================================================
# STATUS
# ============================================================


@router.get(
    "/{document_id}/status"
)
async def get_document_status(
    document_id: str,
) -> dict[str, Any]:

    document = _get_document(
        document_id
    )

    status_value = document.get(
        "status",
        "unknown",
    )

    if status_value in {
        "completed",
        "manual_review",
    }:
        progress = 1.0

    elif status_value == "processing":
        progress = 0.5

    elif status_value == "uploaded":
        progress = 0.0

    else:
        progress = 0.0

    return {
        "document_id": document_id,
        "status": status_value,
        "progress": progress,
    }


# ============================================================
# RESULT
# ============================================================


@router.get(
    "/{document_id}/result"
)
async def get_document_result(
    document_id: str,
) -> dict[str, Any]:

    _get_document(
        document_id
    )

    result = _repository.get_result(
        document_id
    )

    if result is None:

        raise HTTPException(
            status_code=409,
            detail=(
                "Document processing "
                "not complete"
            ),
        )

    return result


# ============================================================
# MANUAL REVIEW
# ============================================================


@router.post(
    "/{document_id}/review"
)
async def review_document(
    document_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:

    document = _get_document(
        document_id
    )

    result = _repository.get_result(
        document_id
    )

    if result is None:

        raise HTTPException(
            status_code=409,
            detail=(
                "Document has no "
                "extraction result"
            ),
        )

    reviewer_id = payload.get(
        "reviewer_id"
    )

    decision = payload.get(
        "decision"
    )

    field_path = payload.get(
        "field_path"
    )

    original_ai_value = payload.get(
        "original_ai_value"
    )

    final_value = payload.get(
        "final_value"
    )

    review = {
        "reviewer_id": reviewer_id,
        "decision": decision,
        "field_path": field_path,
        "original_ai_value": (
            original_ai_value
        ),
        "final_value": final_value,
        "timestamp": utc_now(),
    }

    # --------------------------------------------------------
    # Apply human correction
    # --------------------------------------------------------

    if (
        decision == "correct"
        and field_path
    ):

        # ML2 structured output stores
        # its clinical data at the top level.
        #
        # Example:
        #
        # medications.0.name
        #
        # diagnoses.0.description

        update_json_path(
            result,
            field_path,
            final_value,
        )

    result.setdefault(
        "reviews",
        [],
    ).append(
        review
    )

    result[
        "requires_manual_review"
    ] = False

    result[
        "status"
    ] = "completed"

    _repository.put_result(
        document_id,
        result,
    )

    document.update(
        {
            "status": "completed",
            "requires_manual_review": False,
        }
    )

    _repository.put_document(
        document
    )

    _repository.audit(
        document_id,
        "MANUAL_REVIEW_COMPLETED",
        review.get(
            "reviewer_id"
        ),
        "success",
        {
            "decision": review.get(
                "decision"
            )
        },
    )

    return {
        "document_id": document_id,
        "status": "completed",
        "review": review,
    }


# ============================================================
# TIMELINE
# ============================================================


@router.get(
    "/{document_id}/timeline"
)
async def document_timeline(
    document_id: str,
) -> dict[str, Any]:

    _get_document(
        document_id
    )

    result = _repository.get_result(
        document_id
    )

    if result is None:

        raise HTTPException(
            status_code=409,
            detail=(
                "Document processing "
                "not complete"
            ),
        )

    events: list[
        dict[str, Any]
    ] = []

    # --------------------------------------------------------
    # ML2 structured timeline
    # --------------------------------------------------------

    encounter = result.get(
        "encounter",
        {},
    )

    if encounter.get(
        "collected_on"
    ):

        events.append(
            {
                "date": encounter.get(
                    "collected_on"
                ),
                "chronology_uncertain": False,
                "type": "encounter",
                "resource": {
                    "encounter": encounter
                },
            }
        )

    # --------------------------------------------------------
    # Procedures
    # --------------------------------------------------------

    for procedure in result.get(
        "procedures",
        [],
    ):

        events.append(
            {
                "date": None,
                "chronology_uncertain": True,
                "type": "procedure",
                "resource": procedure,
            }
        )

    # --------------------------------------------------------
    # Medications
    # --------------------------------------------------------

    for medication in result.get(
        "medications",
        [],
    ):

        events.append(
            {
                "date": None,
                "chronology_uncertain": True,
                "type": "medication",
                "resource": medication,
            }
        )

    # --------------------------------------------------------
    # Diagnoses
    # --------------------------------------------------------

    for diagnosis in result.get(
        "diagnoses",
        [],
    ):

        events.append(
            {
                "date": None,
                "chronology_uncertain": True,
                "type": "condition",
                "resource": diagnosis,
            }
        )

    events.sort(
        key=lambda event: (
            event["date"] is None,
            event["date"] or "",
        )
    )

    return {
        "document_id": document_id,
        "events": events,
    }
