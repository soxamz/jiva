from __future__ import annotations

from app.config import get_settings
from app.crews.close_crew import run_close_crew
from app.crews.interview_crew import run_interview_crew
from app.schemas.intake import (
    FinalizeResponse,
    SessionCreateResponse,
    SessionState,
    TranscriptTurn,
    TurnResponse,
)
from app.schemas.socrates import SocratesSlots
from app.services.asr import transcribe_audio
from app.services.intake_pathways import (
    ALL_SUBTYPES,
    ComplaintSubtype,
    PAIN_ONLY_DIMS,
    asserts_non_pain_chief,
    classify_complaint_subtype,
    classify_pathway,
    compose_probe_fallback,
    denies_pain_frame,
    has_trauma_context,
    looks_like_new_symptom,
    post_close_followup_question,
    probe_order_for_subtype,
    session_patient_language,
    update_session_language,
)
from app.services.transcript_infer import apply_transcript_inferences
from app.services.red_flags import (
    evaluate_red_flags,
    get_emergency_redirect_message,
)
from app.services.session_store import session_store
from app.services.slot_fill import (
    SESSION_EXTRA_FIELDS,
    SOCRATES_FIELDS,
    apply_denial_fill,
    apply_session_denial_fill,
    effective_max_turns,
    force_fill_session_unclear,
    force_fill_unclear,
    is_denial,
    is_sentinel_none,
    next_subtype_dimension,
    patient_extra_value,
    patient_slot_value,
    progress_map,
    probe_order_for_session,
    restrict_interpreter_extras,
    restrict_interpreter_slots,
    should_finalize_dimension,
    should_store_patient_extra,
    subtype_complete,
)

OPENING_MESSAGE = (
    "Namaste. Main aapki clinic visit ke liye symptoms samajhne mein madad karunga. "
    "Please bataiye — aaj aap kis pareshani se doctor se milne aaye hain?"
)

CLOSING_MESSAGE = (
    "Dhanyavaad. Aapki history ready hai — doctor jaldi dekhenge."
)

URGENT_CLOSING_MESSAGE = (
    "Dhanyavaad — yeh urgent lag raha hai. Please triage desk / emergency pe jaayein; "
    "staff ko alert kar diya gaya hai."
)


ALREADY_COMPLETE_MESSAGE = "Intake complete ho chuka hai — doctor jaldi dekhenge."

ACK_MESSAGE = (
    "Dhanyavaad. Main aapki info note kar raha hoon — kya aap aur kuch batana chahte hain?"
)

SOFT_DONE_MESSAGE = (
    "Theek hai. Jab ready ho, Finish intake dabayein — doctor ke liye draft ready ho jayega."
)


class IntakeFlow:
    """Orchestrates ASR → rules → interpret → subtype probes → CloseCrew."""

    def create_session(self) -> SessionCreateResponse:
        session = session_store.create()
        session.transcript.append(
            TranscriptTurn(role="assistant", content=OPENING_MESSAGE)
        )
        session_store.save(session)
        return SessionCreateResponse(
            session_id=session.session_id,
            assistant_message=OPENING_MESSAGE,
        )

    def get_session(self, session_id: str) -> SessionState | None:
        return session_store.get(session_id)

    def process_text_turn(self, session_id: str, text: str) -> TurnResponse:
        session = self._require_session(session_id)
        return self._process_utterance(session, text.strip())

    def process_audio_turn(
        self,
        session_id: str,
        audio_bytes: bytes,
        filename: str,
        language: str | None = None,
    ) -> TurnResponse:
        session = self._require_session(session_id)
        transcript = transcribe_audio(audio_bytes, filename=filename, language=language)
        if not transcript:
            raise ValueError("ASR returned empty transcript")
        return self._process_utterance(session, transcript, transcript_preview=transcript)

    def finalize(self, session_id: str) -> FinalizeResponse:
        session = self._require_session(session_id)
        close = run_close_crew(session)
        session.patient_history = close.patient_history
        session.physician_summary = close.physician_summary
        session.complete = True
        session.last_asked_dimension = None
        session_store.save(session)
        return FinalizeResponse(
            session_id=session.session_id,
            patient_history=close.patient_history,
            physician_summary=close.physician_summary,
            bypass_queue=session.bypass_queue,
        )

    def _process_utterance(
        self,
        session: SessionState,
        text: str,
        transcript_preview: str | None = None,
    ) -> TurnResponse:
        if not text:
            raise ValueError("Empty patient utterance")

        if session.physician_summary is not None:
            rule_result = evaluate_red_flags(text, severity=session.slots.severity)
            if rule_result.is_emergency:
                session.turn_count += 1
                session.transcript.append(
                    TranscriptTurn(role="patient", content=text)
                )
                session.red_flag_history.append(rule_result)
                return self._emergency_turn(session, rule_result, transcript_preview)

            return TurnResponse(
                session_id=session.session_id,
                assistant_message=ALREADY_COMPLETE_MESSAGE,
                red_flags=rule_result,
                matched_rules=rule_result.matched_rules,
                socrates_progress=progress_map(session),
                complete=True,
                severity=session.slots.severity,
                bypass_queue=session.bypass_queue,
                turn_count=session.turn_count,
                transcript_preview=transcript_preview,
            )

        settings = get_settings()
        session.turn_count += 1
        session.transcript.append(TranscriptTurn(role="patient", content=text))

        self._update_subtype(session, text)
        self._reconcile_subtype(session)
        apply_transcript_inferences(session)
        update_session_language(session, text)

        rule_result = evaluate_red_flags(text, severity=session.slots.severity)
        session.red_flag_history.append(rule_result)

        if rule_result.is_emergency:
            return self._emergency_turn(session, rule_result, transcript_preview)

        # Post-close handling before running full interpret when already complete
        if session.complete and session.physician_summary is None:
            return self._handle_post_close_turn(session, text, rule_result, transcript_preview)

        turn = run_interview_crew(
            session,
            text,
            rule_result,
            subtype=self._current_subtype(session),
            probe_text_fn=lambda d, st: compose_probe_fallback(
                d,
                st,
                chief_complaint=session.chief_complaint or "",
                language=session_patient_language(session),
            ),
            closing_message=CLOSING_MESSAGE,
            urgent_closing_message=URGENT_CLOSING_MESSAGE,
            max_intake_turns=effective_max_turns(
                session,
                self._current_subtype(session),
                settings.max_intake_turns,
            ),
        )
        self._apply_interpreter(
            session,
            turn.interpreter,
            text,
            answer_quality=turn.interpreter.answer_quality,
            force_advance=turn.plan.force_advance,
        )
        apply_transcript_inferences(session)
        session.red_flag_history.append(turn.merged_red_flags)

        if turn.merged_red_flags.is_emergency:
            return self._emergency_turn(
                session,
                turn.merged_red_flags,
                transcript_preview,
            )

        plan = turn.plan
        assistant_message = plan.assistant_message
        complete = plan.complete
        urgent_bypass = plan.urgent_bypass
        if plan.action in ("advance", "reprompt") and plan.target_dimension:
            session.last_asked_dimension = plan.target_dimension
            asked = session.metadata.setdefault("asked_dimensions", [])
            if plan.target_dimension not in asked:
                asked.append(plan.target_dimension)
        session.complete = complete
        if complete:
            session.last_asked_dimension = None
        if urgent_bypass:
            session.bypass_queue = True

        session.transcript.append(
            TranscriptTurn(
                role="assistant",
                content=assistant_message,
                red_flags=turn.merged_red_flags,
            )
        )
        session_store.save(session)

        return TurnResponse(
            session_id=session.session_id,
            assistant_message=assistant_message,
            red_flags=turn.merged_red_flags,
            matched_rules=turn.merged_red_flags.matched_rules,
            socrates_progress=progress_map(session),
            complete=session.complete,
            severity=session.slots.severity,
            bypass_queue=session.bypass_queue,
            turn_count=session.turn_count,
            transcript_preview=transcript_preview,
        )

    def _handle_post_close_turn(
        self,
        session: SessionState,
        text: str,
        rule_result,
        transcript_preview: str | None,
    ) -> TurnResponse:
        """After core complete: soft-done on denial, one follow-up on new symptom."""
        # Completing a pending post-close follow-up answer
        if session.metadata.get("post_close_followup_pending"):
            session.metadata["post_close_followup_pending"] = False
            session.metadata["post_close_followups"] = int(
                session.metadata.get("post_close_followups") or 0
            ) + 1
            # Light extract into associations / notes
            if not is_denial(text):
                existing = session.slots.associations or ""
                note = text.strip()[:160]
                if note and note not in existing:
                    session.slots.associations = (
                        f"{existing}; {note}".strip("; ") if existing else note
                    )
            session.metadata["post_close_done"] = True
            msg = SOFT_DONE_MESSAGE
            session.transcript.append(
                TranscriptTurn(role="assistant", content=msg, red_flags=rule_result)
            )
            session_store.save(session)
            return self._turn_response(session, msg, rule_result, transcript_preview)

        if session.metadata.get("post_close_done"):
            msg = SOFT_DONE_MESSAGE
            session.transcript.append(
                TranscriptTurn(role="assistant", content=msg, red_flags=rule_result)
            )
            session_store.save(session)
            return self._turn_response(session, msg, rule_result, transcript_preview)

        if is_denial(text):
            session.metadata["post_close_done"] = True
            msg = SOFT_DONE_MESSAGE
            session.transcript.append(
                TranscriptTurn(role="assistant", content=msg, red_flags=rule_result)
            )
            session_store.save(session)
            return self._turn_response(session, msg, rule_result, transcript_preview)

        # New clinical content → at most one follow-up
        followups_used = int(session.metadata.get("post_close_followups") or 0)
        if looks_like_new_symptom(text) and followups_used < 1:
            session.metadata["post_close_followup_pending"] = True
            # Also merge into associations immediately
            existing = session.slots.associations or ""
            note = text.strip()[:160]
            if note and note not in existing:
                session.slots.associations = (
                    f"{existing}; {note}".strip("; ") if existing else note
                )
            msg = post_close_followup_question(text)
            session.transcript.append(
                TranscriptTurn(role="assistant", content=msg, red_flags=rule_result)
            )
            session_store.save(session)
            return self._turn_response(session, msg, rule_result, transcript_preview)

        # Generic extra info without clear new-symptom keywords
        msg = ACK_MESSAGE
        session.transcript.append(
            TranscriptTurn(role="assistant", content=msg, red_flags=rule_result)
        )
        session_store.save(session)
        return self._turn_response(session, msg, rule_result, transcript_preview)

    def _turn_response(
        self, session: SessionState, message: str, red_flags, transcript_preview
    ) -> TurnResponse:
        return TurnResponse(
            session_id=session.session_id,
            assistant_message=message,
            red_flags=red_flags,
            matched_rules=red_flags.matched_rules,
            socrates_progress=progress_map(session),
            complete=session.complete,
            severity=session.slots.severity,
            bypass_queue=session.bypass_queue,
            turn_count=session.turn_count,
            transcript_preview=transcript_preview,
        )

    def _update_subtype(self, session: SessionState, text: str) -> ComplaintSubtype:
        existing = session.metadata.get("complaint_subtype")
        existing_typed: ComplaintSubtype | None = None
        if existing in ALL_SUBTYPES:
            existing_typed = existing  # type: ignore[assignment]

        # Mid-course: patient rejects pain frame and asserts fever/respiratory
        asserted = asserts_non_pain_chief(text)
        if asserted is not None:
            session.metadata["complaint_subtype"] = asserted
            session.metadata["pathway"] = (
                "urgent_trauma" if asserted == "urgent_trauma" else "general"
            )
            self._skip_irrelevant_pain_dims(session, asserted)
            return asserted

        blob = " ".join(filter(None, [session.chief_complaint or "", text]))
        subtype = classify_complaint_subtype(
            blob, existing_subtype=existing_typed, site=session.slots.site
        )

        # Escape generic pain bank when patient only denies pain
        if (
            existing_typed == "pain"
            and denies_pain_frame(text)
            and asserted is None
        ):
            subtype = "general"
            self._skip_irrelevant_pain_dims(session, subtype)

        session.metadata["complaint_subtype"] = subtype
        session.metadata["trauma_context"] = has_trauma_context(
            " ".join(filter(None, [session.chief_complaint or "", text])),
            session.slots.site,
        )
        # Keep pathway aligned with sticky subtype (do not re-detect from scratch)
        if subtype == "urgent_trauma":
            session.metadata["pathway"] = "urgent_trauma"
        elif subtype in (
            "headache",
            "limb_pain",
            "abdominal_pain",
            "chest_pain_soft",
            "pain",
        ):
            session.metadata["pathway"] = "pain"
        else:
            session.metadata["pathway"] = "general"
        return subtype

    def _reconcile_subtype(self, session: SessionState) -> None:
        """Upgrade urgent_trauma → limb_pain once limb site is known."""
        subtype = self._current_subtype(session)
        if subtype != "urgent_trauma":
            return
        blob = " ".join(
            filter(None, [session.chief_complaint or "", session.slots.site or ""])
        )
        upgraded = classify_complaint_subtype(
            blob, existing_subtype="urgent_trauma", site=session.slots.site
        )
        if upgraded != subtype:
            session.metadata["complaint_subtype"] = upgraded
            session.metadata["trauma_context"] = True
            session.metadata["pathway"] = "pain"

    def _skip_irrelevant_pain_dims(
        self, session: SessionState, new_subtype: ComplaintSubtype
    ) -> None:
        """Mark pain-only dims not in the new bank as not applicable."""
        bank = set(probe_order_for_session(session, new_subtype))
        data = session.slots.model_dump()
        changed = False
        for dim in PAIN_ONLY_DIMS:
            if dim in bank:
                continue
            if dim in SOCRATES_FIELDS and dim != "severity":
                if dim not in session.slots.filled_fields():
                    data[dim] = "none"
                    changed = True
            elif dim in SESSION_EXTRA_FIELDS and not getattr(session, dim, None):
                setattr(session, dim, "none")
        if changed:
            session.slots = SocratesSlots.model_validate(data)
    def _current_subtype(self, session: SessionState) -> ComplaintSubtype:
        value = session.metadata.get("complaint_subtype") or session.metadata.get(
            "pathway", "general"
        )
        if value in ALL_SUBTYPES:
            return value  # type: ignore[return-value]
        return "general"

    def _probe_text(
        self, dim: str, subtype: ComplaintSubtype, session: SessionState
    ) -> str:
        return compose_probe_fallback(
            dim, subtype, chief_complaint=session.chief_complaint or ""
        )

    def _next_assistant_message(
        self, session: SessionState, settings
    ) -> tuple[str, bool, bool]:
        """Subtype probe bank. Returns (message, complete, urgent_bypass)."""
        subtype = self._current_subtype(session)
        hit_max = session.turn_count >= effective_max_turns(
            session, subtype, settings.max_intake_turns
        )
        done = hit_max or subtype_complete(session, subtype)
        next_dim = None if done else next_subtype_dimension(session, subtype)

        if done:
            if subtype == "urgent_trauma":
                return URGENT_CLOSING_MESSAGE, True, True
            return CLOSING_MESSAGE, True, False

        if next_dim is None:
            if subtype == "urgent_trauma":
                return URGENT_CLOSING_MESSAGE, True, True
            return CLOSING_MESSAGE, True, False

        # Only force-fill / ask dims that belong to this bank
        bank = set(probe_order_for_session(session, subtype))
        if next_dim not in bank:
            return CLOSING_MESSAGE, True, False

        session.last_asked_dimension = next_dim
        return self._probe_text(next_dim, subtype, session), False, False

    def _emergency_turn(
        self,
        session: SessionState,
        red_flags,
        transcript_preview: str | None,
    ) -> TurnResponse:
        session.bypass_queue = True
        session.complete = True
        session.last_asked_dimension = None
        if session.chief_complaint is None:
            for t in reversed(session.transcript):
                if t.role == "patient":
                    session.chief_complaint = t.content[:200]
                    break
        message = get_emergency_redirect_message()
        session.transcript.append(
            TranscriptTurn(role="assistant", content=message, red_flags=red_flags)
        )
        session_store.save(session)
        return TurnResponse(
            session_id=session.session_id,
            assistant_message=message,
            red_flags=red_flags,
            matched_rules=red_flags.matched_rules,
            socrates_progress=progress_map(session),
            complete=True,
            severity=session.slots.severity,
            bypass_queue=True,
            turn_count=session.turn_count,
            transcript_preview=transcript_preview,
        )

    def _apply_interpreter(
        self,
        session: SessionState,
        interpreter,
        patient_text: str,
        *,
        answer_quality: str | None = None,
        force_advance: bool = False,
    ) -> None:
        if interpreter.chief_complaint:
            session.chief_complaint = interpreter.chief_complaint
        elif session.chief_complaint is None and session.transcript:
            for t in session.transcript:
                if t.role == "patient":
                    session.chief_complaint = t.content[:200]
                    break

        last_dim = session.last_asked_dimension
        bank = set(probe_order_for_session(session, self._current_subtype(session)))

        # Patient denied pain while a pain-only probe was asked → mark none and move on
        if (
            last_dim
            and last_dim in PAIN_ONLY_DIMS
            and last_dim in SOCRATES_FIELDS
            and denies_pain_frame(patient_text)
        ):
            data = session.slots.model_dump()
            if last_dim != "severity" and last_dim not in session.slots.filled_fields():
                data[last_dim] = "none"
                session.slots = SocratesSlots.model_validate(data)

        gated_slots = restrict_interpreter_slots(
            interpreter.slots, last_dim, patient_text
        )
        session.slots = session.slots.merge(gated_slots)
        session.slots = apply_denial_fill(session.slots, patient_text, last_dim)

        if (
            last_dim
            and last_dim in SOCRATES_FIELDS
            and patient_text.strip()
            and not is_denial(patient_text)
        ):
            current = getattr(session.slots, last_dim, None)
            if current is None or current == "":
                ruled = patient_slot_value(last_dim, patient_text)
                if ruled:
                    data = session.slots.model_dump()
                    data[last_dim] = ruled
                    session.slots = SocratesSlots.model_validate(data)

        raw_extras = {
            f: getattr(interpreter, f, None)
            for f in SESSION_EXTRA_FIELDS
            if getattr(interpreter, f, None)
        }
        gated_extras = restrict_interpreter_extras(raw_extras, last_dim)
        for field, value in gated_extras.items():
            # Reject invented negatives when the patient did not deny
            if is_sentinel_none(value) and not is_denial(patient_text):
                continue
            setattr(session, field, value)

        apply_session_denial_fill(session, patient_text, last_dim)

        if (
            last_dim
            and last_dim in SESSION_EXTRA_FIELDS
            and patient_text.strip()
            and not is_denial(patient_text)
            and should_store_patient_extra(answer_quality)
        ):
            current = getattr(session, last_dim, None)
            if current is None or current == "" or is_sentinel_none(current):
                setattr(session, last_dim, patient_extra_value(last_dim, patient_text))

        finalize = should_finalize_dimension(
            answer_quality, force_advance=force_advance
        )
        if finalize and last_dim and last_dim in bank:
            if last_dim in SOCRATES_FIELDS:
                if last_dim not in session.slots.filled_fields():
                    session.slots = force_fill_unclear(session.slots, last_dim)
            elif last_dim in SESSION_EXTRA_FIELDS:
                if not getattr(session, last_dim):
                    force_fill_session_unclear(session, last_dim)

        if interpreter.allergies:
            session.allergies = sorted(set(session.allergies + interpreter.allergies))
        if interpreter.medications:
            session.medications = sorted(
                set(session.medications + interpreter.medications)
            )
            # Never invent prior_medications from a meds list unless that probe was asked
            if last_dim == "prior_medications" and not session.prior_medications:
                session.prior_medications = ", ".join(interpreter.medications)
        if interpreter.comorbidities:
            session.comorbidities = sorted(
                set(session.comorbidities + interpreter.comorbidities)
            )

    def _require_session(self, session_id: str) -> SessionState:
        session = session_store.get(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")
        return session


intake_flow = IntakeFlow()
