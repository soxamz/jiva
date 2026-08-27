from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2

from .image_ops import (
    ImageQuality,
    PreprocessingVariant,
    analyze_image,
    generate_variants,
    load_image,
    save_variant,
)


@dataclass
class PreprocessingResult:

    original_path: Path

    selected_variant: str

    selected_path: Path

    quality: ImageQuality

    variants: list[dict[str, Any]]

    def model_dump(self) -> dict[str, Any]:

        return {
            "original_path": str(
                self.original_path
            ),
            "selected_variant": (
                self.selected_variant
            ),
            "selected_path": str(
                self.selected_path
            ),
            "quality": (
                self.quality.model_dump()
            ),
            "variants": self.variants,
        }


class PreprocessingPipeline:
    """
    Adaptive medical-document preprocessing.

    IMPORTANT:

    This class does NOT perform OCR.

    It prepares one or more conservative
    image variants for the OCR engine.

    The original image is always preserved.
    """

    def __init__(
        self,
        output_dir: str | Path | None = None,
    ) -> None:

        if output_dir is None:

            output_dir = (
                Path(tempfile.gettempdir())
                / "jiva_preprocessing"
            )

        self.output_dir = Path(
            output_dir
        )

        self.output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

    # ========================================================
    # PROCESS
    # ========================================================

    def process(
        self,
        image_path: str | Path,
    ) -> PreprocessingResult:

        source = Path(
            image_path
        ).resolve()

        image = load_image(
            source
        )

        quality = analyze_image(
            image
        )

        variants = generate_variants(
            image,
            quality,
        )

        # ----------------------------------------------------
        # IMPORTANT:
        #
        # We do NOT automatically select an "enhanced"
        # image merely because its image-quality score is
        # higher.
        #
        # OCR quality must ultimately decide.
        #
        # Therefore original is the safe default.
        # ----------------------------------------------------

        selected = variants[0]

        saved = self._save_variant(
            source,
            selected,
        )

        variant_metadata = []

        for variant in variants:

            variant_metadata.append(
                {
                    "name": variant.name,
                    "scale": variant.scale,
                    "deskewed": variant.deskewed,
                    "contrast_adjusted": (
                        variant.contrast_adjusted
                    ),
                    "denoised": variant.denoised,
                    "sharpened": variant.sharpened,
                    "quality": (
                        variant.quality.model_dump()
                    ),
                }
            )

        return PreprocessingResult(
            original_path=source,
            selected_variant=selected.name,
            selected_path=saved,
            quality=quality,
            variants=variant_metadata,
        )

    # ========================================================
    # GENERATE VARIANTS
    # ========================================================

    def generate(
        self,
        image_path: str | Path,
    ) -> list[PreprocessingVariant]:

        image = load_image(
            image_path
        )

        quality = analyze_image(
            image
        )

        return generate_variants(
            image,
            quality,
        )

    # ========================================================
    # SAVE
    # ========================================================

    def _save_variant(
        self,
        source: Path,
        variant: PreprocessingVariant,
    ) -> Path:

        output = (
            self.output_dir
            / f"{source.stem}"
            f"__{variant.name}"
            f"{source.suffix}"
        )

        return save_variant(
            variant,
            output,
        )

    # ========================================================
    # CLEANUP
    # ========================================================

    def cleanup(
        self,
        result: PreprocessingResult,
    ) -> None:

        paths = {
            Path(
                result.original_path
            ),
        }

        # Never delete the original source.
        # Only remove generated files.

        for variant in result.variants:

            name = variant.get(
                "name"
            )

            if not name:
                continue

            generated = (
                self.output_dir
                / f"{Path(result.original_path).stem}"
                f"__{name}"
                f"{Path(result.original_path).suffix}"
            )

            paths.add(
                generated
            )

        original = Path(
            result.original_path
        ).resolve()

        for path in paths:

            try:

                if (
                    path.resolve()
                    == original
                ):
                    continue

                if path.exists():

                    path.unlink()

            except OSError:
                pass
class DocumentProcessingPipeline(PreprocessingPipeline):
    """
    Backwards-compatible alias for the existing application imports.

    The new adaptive preprocessing implementation lives in
    PreprocessingPipeline.
    """

    pass