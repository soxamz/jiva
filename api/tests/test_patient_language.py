"""Tests for patient language detection and consistent assistant wording."""

import unittest
from unittest.mock import patch

from app.crews.interview_crew import InterviewPlan, _generate_physician_message
from app.schemas.intake import SessionState, TranscriptTurn
from app.services.intake_pathways import (
    compose_probe_fallback,
    detect_patient_language,
    reprompt_text_for,
    session_patient_language,
    update_session_language,
)


class PatientLanguageTests(unittest.TestCase):
    def test_detect_english_from_transcript(self):
        session = SessionState(
            chief_complaint="fell from stairs and left leg pain",
            transcript=[
                TranscriptTurn(role="patient", content="yes no bleeding"),
                TranscriptTurn(role="patient", content="sharp pain 8 out of 10"),
            ],
        )
        self.assertEqual(detect_patient_language(session, "no blood thinners"), "english")

    def test_detect_hinglish_from_tokens(self):
        session = SessionState(
            chief_complaint="bukhar hai",
            transcript=[TranscriptTurn(role="patient", content="kal se hai")],
        )
        self.assertEqual(detect_patient_language(session, "thoda zyada hai"), "hinglish")

    def test_update_session_language_persists(self):
        session = SessionState(chief_complaint="fell from stairs")
        update_session_language(session, "left leg hurts badly")
        self.assertEqual(session_patient_language(session), "english")

    def test_english_reprompt_fallback_for_age(self):
        text = reprompt_text_for("ayush_vaya", "limb_pain", language="english")
        self.assertIsNotNone(text)
        assert text is not None
        self.assertIn("age", text.lower())
        self.assertNotIn("umar", text.lower())

    def test_english_probe_fallback(self):
        msg = compose_probe_fallback(
            "ayush_vaya", "limb_pain", "fell from stairs", language="english"
        )
        self.assertIn("age", msg.lower())
        self.assertNotIn("umar", msg.lower())

    def test_reprompt_uses_english_fallback_when_groq_unavailable(self):
        session = SessionState(
            chief_complaint="fell from stairs and left leg pain",
            metadata={"patient_language": "english"},
            last_asked_dimension="ayush_vaya",
        )
        plan = InterviewPlan(action="reprompt", target_dimension="ayush_vaya")
        assessor = {"answer_quality": "off_topic"}
        with patch("app.crews.interview_crew._run_physician_groq", return_value=None):
            msg = _generate_physician_message(
                session,
                "papa said to study well",
                "limb_pain",
                plan,
                assessor,
                lambda d, st: compose_probe_fallback(
                    d, st, session.chief_complaint or "", language="english"
                ),
            )
        self.assertIn("age", msg.lower())
        self.assertNotIn("umar", msg.lower())


if __name__ == "__main__":
    unittest.main()
