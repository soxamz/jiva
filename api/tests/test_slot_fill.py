"""Unit tests for deterministic SOCRATES denial fill and next-dimension logic."""

import unittest
from unittest.mock import patch

from types import SimpleNamespace

from app.crews.turn_crew import InterpreterOutput
from app.flows.intake_flow import (
    ALREADY_COMPLETE_MESSAGE,
    CLOSING_MESSAGE,
    IntakeFlow,
)
from app.schemas.intake import PhysicianSummary, RedFlagResult, SessionState
from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import PROBE_QUESTIONS
from app.services.slot_fill import (
    apply_denial_fill,
    core_complete,
    force_fill_unclear,
    has_explicit_severity,
    is_denial,
    next_required_dimension,
    restrict_interpreter_extras,
    restrict_interpreter_slots,
)


class SlotFillTests(unittest.TestCase):
    def test_is_denial_en_and_hinglish(self):
        self.assertTrue(is_denial("No"))
        self.assertTrue(is_denial("Nhii"))
        self.assertTrue(is_denial("nhi"))
        self.assertTrue(is_denial("nahi"))
        self.assertTrue(is_denial("none"))
        self.assertTrue(is_denial("not really"))
        self.assertTrue(is_denial("no i said earlier"))
        self.assertFalse(is_denial("left hand pain"))
        self.assertFalse(is_denial("it spreads to my arm"))

    def test_denial_fill_radiation_nhii(self):
        slots = SocratesSlots(
            site="left hand",
            onset="2 days",
            character="aching",
            severity=6,
        )
        filled = apply_denial_fill(slots, "Nhii", "radiation")
        self.assertEqual(filled.radiation, "none")
        self.assertIn("radiation", filled.filled_fields())
        self.assertEqual(next_required_dimension(filled), "associations")

    def test_denial_fill_radiation_no(self):
        slots = SocratesSlots(site="chest")
        filled = apply_denial_fill(slots, "no", "radiation")
        self.assertEqual(filled.radiation, "none")

    def test_denial_does_not_overwrite_existing(self):
        slots = SocratesSlots(radiation="to left arm")
        filled = apply_denial_fill(slots, "no", "radiation")
        self.assertEqual(filled.radiation, "to left arm")

    def test_denial_ignored_without_last_asked(self):
        slots = SocratesSlots(site="hand")
        filled = apply_denial_fill(slots, "Nhii", None)
        self.assertIsNone(filled.radiation)

    def test_next_prefers_core_over_time_course(self):
        slots = SocratesSlots(
            site="hand",
            onset="yesterday",
            character="sharp",
            severity=4,
            radiation="none",
        )
        self.assertEqual(next_required_dimension(slots), "associations")

    def test_core_complete_ignores_optional_slots(self):
        slots = SocratesSlots(
            site="hand",
            onset="2 days",
            character="dull",
            severity=5,
            radiation="none",
            associations="none",
        )
        self.assertTrue(core_complete(slots))
        self.assertIsNone(next_required_dimension(slots))
        self.assertIsNone(slots.time_course)
        self.assertIsNone(slots.exacerbating_relieving)

    def test_core_complete_false_when_radiation_missing(self):
        slots = SocratesSlots(
            site="hand",
            onset="2 days",
            character="dull",
            severity=5,
            associations="fever",
        )
        self.assertFalse(core_complete(slots))
        self.assertEqual(next_required_dimension(slots), "radiation")

    def test_no_radiation_reask_after_denial(self):
        slots = SocratesSlots(
            site="left hand",
            onset="today",
            character="pain",
            severity=7,
        )
        slots = apply_denial_fill(slots, "No", "radiation")
        self.assertEqual(slots.radiation, "none")
        nxt = next_required_dimension(slots)
        self.assertNotEqual(nxt, "radiation")
        self.assertEqual(nxt, "associations")

    def test_force_fill_unclear_anti_loop(self):
        slots = SocratesSlots(site="hand")
        slots = force_fill_unclear(slots, "onset")
        self.assertEqual(slots.onset, "unclear")
        self.assertEqual(next_required_dimension(slots), "character")

    def test_apply_interpreter_denial_then_next_is_associations(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="radiation",
            metadata={"complaint_subtype": "chest_pain_soft", "pathway": "pain"},
            slots=SocratesSlots(
                site="chest",
                onset="today",
                character="pain",
                severity=7,
            ),
        )
        interpreter = InterpreterOutput()
        flow._apply_interpreter(session, interpreter, "Nhii")
        self.assertEqual(session.slots.radiation, "none")
        message, complete, _bypass = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=10)
        )
        self.assertFalse(complete)
        self.assertEqual(session.last_asked_dimension, "associations")
        self.assertIn("saans", message.lower())

    def test_core_complete_session_does_not_reask_radiation(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="associations",
            turn_count=6,
            metadata={"complaint_subtype": "general", "pathway": "general"},
            slots=SocratesSlots(
                site="hand",
                onset="2 days",
                character="dull",
                severity=5,
                radiation="none",
                associations="none",
            ),
            prior_medications="none",
            prior_consult="none",
            ayush_vaya="30",
            ayush_prakriti="madhyam",
            ayush_vikriti="same",
            ayush_agni="ok",
            ayush_bala="madhyam",
            ayush_manas_vyayam="ok",
        )
        message, complete, _bypass = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=10)
        )
        self.assertTrue(complete)
        self.assertEqual(message, CLOSING_MESSAGE)

    def test_core_complete_sends_closing(self):
        flow = IntakeFlow()
        settings = SimpleNamespace(max_intake_turns=10)
        slots = SocratesSlots(
            site="hand",
            onset="2 days",
            character="dull",
            severity=5,
            associations="none",
        )

        session_first = SessionState(
            complete=False,
            metadata={"complaint_subtype": "general", "pathway": "general"},
            slots=slots,
            prior_medications="none",
            prior_consult="none",
            ayush_vaya="30",
            ayush_prakriti="madhyam",
            ayush_vikriti="same",
            ayush_agni="ok",
            ayush_bala="madhyam",
            ayush_manas_vyayam="ok",
        )
        msg1, complete1, _ = flow._next_assistant_message(session_first, settings)
        self.assertTrue(complete1)
        self.assertEqual(msg1, CLOSING_MESSAGE)

    def test_ignore_turns_after_finalize_when_physician_summary_exists(self):
        flow = IntakeFlow()
        session = SessionState(
            physician_summary=PhysicianSummary(
                en="x",
                hi="y",
                is_draft=True,
                disclaimer="d",
            ),
            slots=SocratesSlots(
                site="hand",
                onset="2 days",
                character="dull",
                severity=5,
                radiation="none",
                associations="none",
            ),
            complete=True,
            turn_count=3,
        )

        with patch(
            "app.flows.intake_flow.evaluate_red_flags"
        ) as mock_evaluate_red_flags:
            mock_evaluate_red_flags.return_value = RedFlagResult(
                is_emergency=False,
                flags=[],
                matched_rules=[],
                triage_action="continue",
                reason="",
                source="rules",
            )
            turn = flow._process_utterance(session, "some extra details")

        self.assertTrue(turn.complete)
        self.assertEqual(turn.assistant_message, ALREADY_COMPLETE_MESSAGE)
        # finalized guard should not append the patient transcript
        self.assertEqual(len(session.transcript), 0)

    def test_restrict_drops_unasked_invented_slots(self):
        invented = SocratesSlots(
            character="mild",
            severity=2,
            radiation="none",
            associations="none",
            time_course="none",
            exacerbating_relieving="none",
        )
        gated = restrict_interpreter_slots(
            invented, "character", "kuch nhi buss halka pain"
        )
        self.assertEqual(gated.character, "mild")
        self.assertIsNone(gated.severity)
        self.assertIsNone(gated.radiation)
        self.assertIsNone(gated.associations)
        extras = restrict_interpreter_extras({"pain_now": "mild"}, "character")
        self.assertEqual(extras, {})

    def test_explicit_severity_detection(self):
        self.assertTrue(has_explicit_severity("6"))
        self.assertTrue(has_explicit_severity("6/10"))
        self.assertFalse(has_explicit_severity("halka pain"))
        self.assertFalse(has_explicit_severity("3 din phlee"))
        self.assertFalse(has_explicit_severity("i have fever of 102"))
        self.assertFalse(has_explicit_severity("102°F"))

    def test_coerce_severity_drops_fever_temperature(self):
        from app.services.slot_fill import (
            coerce_severity_score,
            effective_answer_quality,
            patient_slot_value,
            sanitize_slots_dict,
        )

        self.assertIsNone(coerce_severity_score("102°F"))
        self.assertIsNone(coerce_severity_score(102))
        self.assertEqual(coerce_severity_score("7/10"), 7)
        self.assertEqual(coerce_severity_score(8), 8)
        cleaned = sanitize_slots_dict({"severity": "102°F", "onset": "2 days"})
        self.assertNotIn("severity", cleaned)
        self.assertEqual(cleaned["onset"], "2 days")
        self.assertEqual(patient_slot_value("time_course", "lagataar h"), "continuous")
        self.assertEqual(
            effective_answer_quality("time_course", "lagataar h", "vague"),
            "answered",
        )


if __name__ == "__main__":
    unittest.main()
