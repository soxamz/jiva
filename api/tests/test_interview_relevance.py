"""Tests for LLM-driven intake relevance, reprompts, and draft sanitization."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.crews.close_crew import compose_hpi_en
from app.crews.interview_crew import InterviewCrewResult, InterviewPlan
from app.crews.turn_crew import InterpreterOutput
from app.flows.intake_flow import CLOSING_MESSAGE, IntakeFlow
from app.schemas.intake import RedFlagResult, SessionState
from app.schemas.socrates import SocratesSlots
from app.services.slot_fill import (
    effective_answer_quality,
    should_finalize_dimension,
    should_store_patient_extra,
)


def _flags_continue() -> RedFlagResult:
    return RedFlagResult(
        is_emergency=False,
        flags=[],
        matched_rules=[],
        triage_action="continue",
        reason="",
        source="rules",
    )


def _mock_interview(
    interpreter: InterpreterOutput,
    plan: InterviewPlan,
) -> InterviewCrewResult:
    return InterviewCrewResult(
        interpreter=interpreter,
        plan=plan,
        merged_red_flags=_flags_continue(),
    )


class InterviewRelevanceTests(unittest.TestCase):
    def test_rule_based_quality_rejects_burger_for_agni(self):
        self.assertEqual(
            effective_answer_quality(
                "ayush_agni", "Im hungryyyy give me burger", "answered"
            ),
            "off_topic",
        )

    def test_rule_based_quality_rejects_happy_day(self):
        self.assertEqual(
            effective_answer_quality("severity", "happy day", "answered"),
            "off_topic",
        )

    def test_rule_based_quality_rejects_abcd(self):
        self.assertEqual(
            effective_answer_quality("associations", "abcd", "answered"),
            "off_topic",
        )

    def test_rule_based_quality_rejects_papa_said_coffee(self):
        self.assertEqual(
            effective_answer_quality("associations", "papa said coffee", "answered"),
            "off_topic",
        )

    def test_rule_based_quality_rejects_papa_study_for_age(self):
        self.assertEqual(
            effective_answer_quality(
                "ayush_vaya", "papa said to study well", "answered"
            ),
            "off_topic",
        )

    def test_rule_based_quality_rejects_mom_engineer_for_age(self):
        self.assertEqual(
            effective_answer_quality(
                "ayush_vaya", "mom said become an engineer", "answered"
            ),
            "off_topic",
        )

    def test_rule_based_assessor_extracts_severity(self):
        from app.crews.interview_crew import _rule_based_assessor

        session = SessionState(last_asked_dimension="severity")
        data = _rule_based_assessor(session, "8", "pain")
        self.assertEqual(data["answer_quality"], "answered")
        self.assertEqual(data["slots"]["severity"], 8)

    def test_shin_site_not_mapped_to_forehead(self):
        from app.crews.close_crew import _clinical_en

        self.assertIn("shin", (_clinical_en("site", "closer to shin") or "").lower())

    def test_should_not_store_off_topic_extra(self):
        self.assertFalse(should_store_patient_extra("off_topic"))
        self.assertFalse(should_store_patient_extra("vague"))
        self.assertFalse(should_store_patient_extra("confused"))
        self.assertTrue(should_store_patient_extra("answered"))

    def test_should_not_finalize_on_reprompt(self):
        self.assertFalse(
            should_finalize_dimension("vague", force_advance=False)
        )
        self.assertTrue(
            should_finalize_dimension("vague", force_advance=True)
        )
        self.assertTrue(
            should_finalize_dimension("answered", force_advance=False)
        )

    def test_vague_severity_reprompts_same_dimension(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            last_asked_dimension="severity",
            chief_complaint="fever 102",
        )
        interpreter = InterpreterOutput(
            answer_quality="vague",
            slots=SocratesSlots(onset="4 days"),
        )
        plan = InterviewPlan(
            action="reprompt",
            target_dimension="severity",
            assistant_message="0 se 10 mein number batayein — abhi bukhar kitna feel ho raha hai?",
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            turn = flow._process_utterance(session, "Amar Munnaay Dosh")
        self.assertEqual(session.last_asked_dimension, "severity")
        self.assertIsNone(session.slots.severity)
        self.assertIn("10", turn.assistant_message)

    def test_confused_prior_meds_reprompt_not_stored(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            last_asked_dimension="prior_medications",
            chief_complaint="fever",
            slots=SocratesSlots(onset="4 days", severity=5, associations="shivering"),
            prior_medications=None,
        )
        interpreter = InterpreterOutput(answer_quality="confused")
        plan = InterviewPlan(
            action="reprompt",
            target_dimension="prior_medications",
            assistant_message=(
                "Main pooch raha hoon — is bukhar ke liye aapne koi dawai li "
                "(jaise paracetamol)? Haan/nahi ya naam batayein."
            ),
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            turn = flow._process_utterance(session, "What do you mean")
        self.assertEqual(session.last_asked_dimension, "prior_medications")
        self.assertIsNone(session.prior_medications)
        self.assertIn("dawai", turn.assistant_message.lower())

    def test_off_topic_burger_not_stored_in_agni(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            last_asked_dimension="ayush_agni",
            chief_complaint="fever",
            slots=SocratesSlots(onset="4 days", severity=5),
        )
        interpreter = InterpreterOutput(answer_quality="off_topic")
        plan = InterviewPlan(
            action="reprompt",
            target_dimension="ayush_agni",
            assistant_message="Abhi bhookh normal hai, kam hai, ya bilkul nahi?",
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            flow._process_utterance(session, "Im hungryyyy give me burger")
        self.assertIsNone(session.ayush_agni)

    def test_prior_consult_vague_family_reprompt(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            last_asked_dimension="prior_consult",
            chief_complaint="fever",
            slots=SocratesSlots(onset="4 days", severity=5),
            prior_consult=None,
        )
        interpreter = InterpreterOutput(answer_quality="vague")
        plan = InterviewPlan(
            action="reprompt",
            target_dimension="prior_consult",
            assistant_message=(
                "Doctor/clinic se pehle is bukhar ke liye consult kiya tha? "
                "Family se milna alag hai — sirf doctor visit batayein."
            ),
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            turn = flow._process_utterance(session, "papa se mila tha")
        self.assertEqual(session.last_asked_dimension, "prior_consult")
        self.assertIsNone(session.prior_consult)
        self.assertIn("doctor", turn.assistant_message.lower())

    def test_clear_answer_advances_fever_onset(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            chief_complaint="fever 102",
        )
        interpreter = InterpreterOutput(
            answer_quality="answered",
            chief_complaint="fever 102",
            slots=SocratesSlots(onset="4 days"),
        )
        plan = InterviewPlan(
            action="advance",
            target_dimension="severity",
            assistant_message="0 se 10 mein bukhar kitna severe lag raha hai?",
            force_advance=False,
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            flow._process_utterance(session, "four days")
        self.assertEqual(session.last_asked_dimension, "severity")
        self.assertEqual(session.slots.onset, "4 days")

    def test_reprompt_cap_marks_unclear_and_advances(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={
                "complaint_subtype": "fever",
                "reprompt_counts": {"severity": 2},
            },
            last_asked_dimension="severity",
            chief_complaint="fever",
            slots=SocratesSlots(onset="4 days"),
        )
        interpreter = InterpreterOutput(answer_quality="vague")
        plan = InterviewPlan(
            action="advance",
            target_dimension="associations",
            assistant_message="Saath mein thand, ulti, ya khaansi?",
            force_advance=True,
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            flow._process_utterance(session, "still nonsense")
        self.assertEqual(session.slots.severity, 5)
        self.assertEqual(session.last_asked_dimension, "associations")

    def test_finalize_hpi_omits_garbage_quotes(self):
        session = SessionState(
            chief_complaint="fever 102",
            metadata={"intake_inconsistencies": ["age 3 years with weight 80 kg"]},
            slots=SocratesSlots(onset="4 days", severity=5, associations="shivering"),
            prior_medications="What do you mean",
            prior_consult="papa se mila tha",
            ayush_vaya="3",
            ayush_bala="80kg",
            ayush_agni="Im hungryyyy give me burger",
        )
        en = compose_hpi_en(session)
        self.assertNotIn("burger", en.lower())
        self.assertNotIn("what do you mean", en.lower())
        self.assertNotIn("papa se mila", en.lower())
        self.assertIn("Verify with patient", en)
        self.assertIn("age 3", en)

    def test_build_plan_reprompt_increments_count(self):
        from app.crews.interview_crew import _build_plan

        session = SessionState(
            last_asked_dimension="severity",
            metadata={"complaint_subtype": "fever"},
            slots=SocratesSlots(onset="4 days"),
        )
        plan = _build_plan(
            session=session,
            subtype="fever",
            assessor={"answer_quality": "vague"},
            closing_message=CLOSING_MESSAGE,
            urgent_closing_message="urgent",
            max_intake_turns=40,
        )
        self.assertEqual(plan.action, "reprompt")
        self.assertEqual(plan.target_dimension, "severity")
        self.assertEqual(session.metadata["reprompt_counts"]["severity"], 1)

    def test_lagataar_fills_time_course_via_rules(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            last_asked_dimension="time_course",
            chief_complaint="fever 102",
            slots=SocratesSlots(onset="3 days", severity=5, associations="body ache"),
        )
        interpreter = InterpreterOutput(answer_quality="vague")
        plan = InterviewPlan(
            action="advance",
            target_dimension="ayush_vaya",
            assistant_message="Aapki umar kitni hai?",
            force_advance=False,
        )
        with patch(
            "app.flows.intake_flow.run_interview_crew",
            return_value=_mock_interview(interpreter, plan),
        ), patch(
            "app.flows.intake_flow.evaluate_red_flags",
            return_value=_flags_continue(),
        ):
            flow._process_utterance(session, "lagataar h")
        self.assertEqual(session.slots.time_course, "continuous")
        self.assertEqual(session.last_asked_dimension, "ayush_vaya")

    def test_advance_plan_skips_answered_site_before_apply(self):
        from app.crews.interview_crew import _advance_plan

        session = SessionState(
            last_asked_dimension="site",
            metadata={"complaint_subtype": "limb_pain", "trauma_context": True},
        )
        plan = _advance_plan(
            session,
            "limb_pain",
            CLOSING_MESSAGE,
            "urgent",
            force_advance=False,
            assessor={"answer_quality": "answered"},
        )
        self.assertEqual(plan.target_dimension, "onset")

    def test_advance_plan_skips_filled_time_course(self):
        from app.crews.interview_crew import _advance_plan

        session = SessionState(
            metadata={"complaint_subtype": "fever"},
            slots=SocratesSlots(
                onset="3 days",
                severity=5,
                associations="body ache",
                time_course="continuous",
            ),
        )
        plan = _advance_plan(
            session,
            "fever",
            CLOSING_MESSAGE,
            "urgent",
            force_advance=False,
        )
        self.assertEqual(plan.target_dimension, "ayush_vaya")
        self.assertNotEqual(plan.target_dimension, "time_course")

    def test_message_rejects_age_question_for_time_course(self):
        from app.crews.interview_crew import _message_matches_dimension

        self.assertFalse(
            _message_matches_dimension(
                "I'm sorry, I didn't get your age. How old are you?",
                "time_course",
            )
        )
        self.assertTrue(
            _message_matches_dimension(
                "Is your fever constant or does it come and go?",
                "time_course",
            )
        )

    def test_devanagari_rejected(self):
        from app.crews.interview_crew import _contains_devanagari

        self.assertTrue(_contains_devanagari("क्या आपका बुखार लगातार है"))
        self.assertFalse(_contains_devanagari("Kya bukhar lagatar hai?"))

    def test_ayush_draft_no_typing_boilerplate_when_unasked(self):
        from app.services.ayush_analysis import build_ayush_block

        session = SessionState(
            chief_complaint="fever",
            ayush_vaya="20 years",
            metadata={"asked_dimensions": ["ayush_vaya"]},
        )
        block = build_ayush_block(session)
        notes = block.provisional_notes or ""
        self.assertNotIn("Insufficient distinctive dosha cues", notes)
        self.assertNotIn("Prakriti/Vikriti typing", notes)


if __name__ == "__main__":
    unittest.main()
