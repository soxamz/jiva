"""Tests for physician-like adaptive intake."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.crews.close_crew import compose_hpi_en
from app.crews.turn_crew import InterpreterOutput
from app.flows.intake_flow import (
    ACK_MESSAGE,
    CLOSING_MESSAGE,
    SOFT_DONE_MESSAGE,
    IntakeFlow,
)
from app.schemas.intake import RedFlagResult, SessionState
from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import (
    DASHAVIDHA_ORDER,
    classify_complaint_subtype,
    probe_order_for_subtype,
    relevant_ayush_dimensions,
)
from app.services.slot_fill import (
    apply_session_denial_fill,
    next_subtype_dimension,
    progress_map,
)
from app.services.transcript_infer import apply_transcript_inferences


def _flags_continue() -> RedFlagResult:
    return RedFlagResult(
        is_emergency=False,
        flags=[],
        matched_rules=[],
        triage_action="continue",
        reason="",
        source="rules",
    )


class PhysicianLikeTests(unittest.TestCase):
    def test_classify_headache_vs_limb(self):
        self.assertEqual(
            classify_complaint_subtype("i have high headache"), "headache"
        )
        self.assertEqual(
            classify_complaint_subtype("pain in my left hand"), "limb_pain"
        )
        self.assertEqual(
            classify_complaint_subtype(
                "i fell from stairs and now have pain in my left leg"
            ),
            "limb_pain",
        )
        self.assertEqual(
            classify_complaint_subtype("halka pet dard"), "abdominal_pain"
        )

    def test_limb_order_includes_mechanism_not_bleed(self):
        order = probe_order_for_subtype("limb_pain", site="left hand")
        self.assertIn("mechanism", order)
        self.assertIn("prior_consult", order)
        self.assertIn("prior_medications", order)
        self.assertNotIn("bleeding_now", order)
        self.assertNotIn("blood_thinners", order)
        self.assertNotIn("consciousness", order)

    def test_limb_trauma_bank_includes_bleeding_and_ayush(self):
        order = probe_order_for_subtype(
            "limb_pain", site="left leg", trauma_context=True
        )
        self.assertIn("bleeding_now", order)
        self.assertIn("consciousness", order)
        self.assertIn("ayush_vaya", order)
        self.assertLess(order.index("bleeding_now"), order.index("ayush_vaya"))

    def test_trauma_ayush_subset_excludes_agni_and_prakriti(self):
        session = SessionState(
            chief_complaint="fell from stairs and now left leg pains",
            metadata={"complaint_subtype": "limb_pain", "trauma_context": True},
            slots=SocratesSlots(site="left leg", onset="today"),
        )
        apply_transcript_inferences(session)
        ayush = relevant_ayush_dimensions(session, "limb_pain")
        self.assertIn("ayush_vaya", ayush)
        self.assertIn("ayush_vikriti", ayush)
        self.assertIn("ayush_bala", ayush)
        self.assertIn("ayush_manas_vyayam", ayush)
        self.assertNotIn("ayush_agni", ayush)
        self.assertNotIn("ayush_prakriti", ayush)
        from app.services.slot_fill import probe_order_for_session

        order = probe_order_for_session(session, "limb_pain")
        self.assertNotIn("ayush_agni", order)
        self.assertNotIn("ayush_prakriti", order)

    def test_fall_leg_skips_mechanism_when_stated_in_opening(self):
        session = SessionState(
            chief_complaint="fell from stairs and now have pain in my left leg",
            metadata={"complaint_subtype": "limb_pain", "trauma_context": True},
            slots=SocratesSlots(site="left leg", onset="today"),
        )
        apply_transcript_inferences(session)
        self.assertEqual(session.mechanism, "fall")
        nxt = next_subtype_dimension(session, "limb_pain")
        self.assertNotEqual(nxt, "mechanism")
        self.assertEqual(nxt, "bleeding_now")

    def test_headache_progress_excludes_bleeding(self):
        session = SessionState(
            metadata={"complaint_subtype": "headache"},
            slots=SocratesSlots(site="head", onset="last night", severity=8),
        )
        prog = progress_map(session, "headache")
        self.assertIn("site", prog)
        self.assertIn("prior_consult", prog)
        self.assertNotIn("bleeding_now", prog)
        self.assertNotIn("blood_thinners", prog)

    def test_limb_asks_mechanism_after_onset(self):
        session = SessionState(
            metadata={"complaint_subtype": "limb_pain"},
            slots=SocratesSlots(site="left hand", onset="4 days"),
        )
        self.assertEqual(next_subtype_dimension(session, "limb_pain"), "mechanism")

    def test_denial_on_mechanism(self):
        session = SessionState(last_asked_dimension="mechanism")
        apply_session_denial_fill(session, "no", "mechanism")
        self.assertEqual(session.mechanism, "none")

    def test_ack_no_becomes_soft_done(self):
        flow = IntakeFlow()
        session = SessionState(
            complete=True,
            metadata={"complaint_subtype": "pain", "pathway": "pain"},
            slots=SocratesSlots(
                site="hand",
                onset="4 days",
                character="pain",
                severity=8,
            ),
            turn_count=5,
        )
        with patch(
            "app.flows.intake_flow.evaluate_red_flags", return_value=_flags_continue()
        ):
            turn = flow._process_utterance(session, "no")
        self.assertEqual(turn.assistant_message, SOFT_DONE_MESSAGE)
        self.assertTrue(session.metadata.get("post_close_done"))

        with patch(
            "app.flows.intake_flow.evaluate_red_flags", return_value=_flags_continue()
        ):
            turn2 = flow._process_utterance(session, "no")
        self.assertEqual(turn2.assistant_message, SOFT_DONE_MESSAGE)
        self.assertNotEqual(turn2.assistant_message, ACK_MESSAGE)

    def test_post_close_new_symptom_one_followup(self):
        flow = IntakeFlow()
        session = SessionState(
            complete=True,
            metadata={"complaint_subtype": "limb_pain", "pathway": "pain"},
            slots=SocratesSlots(site="left hand", onset="4 days", severity=8),
            turn_count=6,
        )
        with patch(
            "app.flows.intake_flow.evaluate_red_flags", return_value=_flags_continue()
        ):
            turn = flow._process_utterance(session, "mujhe halka bukhar bhi h")
        self.assertTrue(session.metadata.get("post_close_followup_pending"))
        self.assertIn("Bukhar", turn.assistant_message)

        with patch(
            "app.flows.intake_flow.evaluate_red_flags", return_value=_flags_continue()
        ):
            turn2 = flow._process_utterance(session, "kal se halka")
        self.assertEqual(turn2.assistant_message, SOFT_DONE_MESSAGE)
        self.assertEqual(session.metadata.get("post_close_followups"), 1)

        with patch(
            "app.flows.intake_flow.evaluate_red_flags", return_value=_flags_continue()
        ):
            turn3 = flow._process_utterance(session, "aur pet dard")
        # Cap reached — soft done, no second follow-up
        self.assertEqual(turn3.assistant_message, SOFT_DONE_MESSAGE)

    def test_draft_includes_site_and_character(self):
        session = SessionState(
            chief_complaint="high headache",
            slots=SocratesSlots(
                site="head",
                onset="last night",
                character="pressure",
                severity=8,
                associations="mild fever",
            ),
            prior_medications="none",
            prior_consult="none",
        )
        en = compose_hpi_en(session)
        self.assertIn("head", en.lower())
        self.assertIn("pressure", en.lower())
        self.assertIn("last night", en.lower())
        self.assertIn("8/10", en)
        self.assertNotRegex(en.lower(), r"^draft summary:\s*patient reports severe pain")

    def test_flow_limb_probe_mechanism_wording(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "limb_pain"},
            slots=SocratesSlots(site="left hand", onset="4 days"),
        )
        msg, complete, _ = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=10)
        )
        self.assertFalse(complete)
        self.assertEqual(session.last_asked_dimension, "mechanism")
        self.assertIn("Chot", msg)

    def test_headache_closing_when_bank_filled(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "headache"},
            slots=SocratesSlots(
                site="forehead",
                onset="last night",
                character="pressure",
                severity=8,
                associations="mild fever",
                time_course="waves",
                exacerbating_relieving="spontaneous",
            ),
            ayush_vaya="30",
            ayush_prakriti="madhyam",
            ayush_vikriti="zyada dard",
            ayush_agni="normal",
            ayush_bala="madhyam build",
            ayush_manas_vyayam="stress mild, walk ok",
            prior_medications="none",
            prior_consult="none",
            turn_count=15,
        )
        msg, complete, bypass = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=40)
        )
        self.assertTrue(complete)
        self.assertFalse(bypass)
        self.assertEqual(msg, CLOSING_MESSAGE)

    def test_back_pain_order_asks_mechanism_before_character(self):
        order = probe_order_for_subtype("pain", site="lower back")
        self.assertIn("mechanism", order)
        self.assertLess(order.index("mechanism"), order.index("character"))
        self.assertIn("radiation", order)
        self.assertIn("exacerbating_relieving", order)

    def test_interpreter_cannot_invent_unasked_slots(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="character",
            metadata={"complaint_subtype": "pain", "pathway": "pain"},
            slots=SocratesSlots(site="lower back", onset="3 days"),
        )
        interpreter = InterpreterOutput(
            slots=SocratesSlots(
                character="mild",
                severity=2,
                radiation="none",
                associations="none",
                time_course="none",
                exacerbating_relieving="none",
            ),
            pain_now="mild",
        )
        flow._apply_interpreter(session, interpreter, "kuch nhi buss halka pain")
        self.assertEqual(session.slots.character, "mild")
        self.assertIsNone(session.slots.severity)
        self.assertIsNone(session.slots.radiation)
        self.assertIsNone(session.slots.associations)
        self.assertIsNone(session.slots.time_course)
        self.assertIsNone(session.slots.exacerbating_relieving)
        self.assertIsNone(session.pain_now)
        prog = progress_map(session, "pain")
        self.assertFalse(prog.get("radiation", True))
        self.assertFalse(prog.get("associations", True))
        self.assertFalse(prog.get("severity", True))

    def test_compose_omits_unasked_and_labels_denials(self):
        session = SessionState(
            slots=SocratesSlots(
                site="lower back",
                onset="3 days",
                character="mild",
            ),
            prior_medications="none",
        )
        en = compose_hpi_en(session)
        self.assertIn("lower back", en.lower())
        self.assertIn("severity not recorded", en.lower())
        self.assertNotIn("radiation", en.lower())
        self.assertNotIn("associations", en.lower())
        self.assertIn("denied", en.lower())

    def test_compose_clinicalizes_hinglish_and_yes_consult(self):
        session = SessionState(
            slots=SocratesSlots(
                site="poora sir",
                onset="dheere dheere",
                character="kuch khash nhi only headache",
                severity=6,
            ),
            prior_medications="celene",
            prior_consult="yes",
        )
        en = compose_hpi_en(session)
        self.assertIn("whole head", en.lower())
        self.assertIn("gradual onset", en.lower())
        self.assertIn("nonspecific headache", en.lower())
        self.assertIn("prior consult:** yes", en.lower())
        self.assertIn("celene", en.lower())
        self.assertIn("\n- **", en)
        self.assertNotIn("dheere dheere history of kuch", en.lower())
        self.assertNotIn("denied", en.lower())

    def test_false_none_on_prior_meds_uses_patient_text(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="prior_medications",
            metadata={"complaint_subtype": "headache", "pathway": "pain"},
            slots=SocratesSlots(
                site="whole head", onset="gradual", character="ache", severity=6
            ),
        )
        interpreter = InterpreterOutput(prior_medications="None")
        flow._apply_interpreter(session, interpreter, "haa celene")
        self.assertEqual(session.prior_medications, "celene")

    def test_yes_prior_consult_not_overwritten_by_none(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="prior_consult",
            metadata={"complaint_subtype": "headache", "pathway": "pain"},
            slots=SocratesSlots(
                site="whole head", onset="gradual", character="ache", severity=6
            ),
        )
        interpreter = InterpreterOutput(prior_consult="none")
        flow._apply_interpreter(session, interpreter, "yes")
        self.assertEqual(session.prior_consult, "yes")


if __name__ == "__main__":
    unittest.main()
