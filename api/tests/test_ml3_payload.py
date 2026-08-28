"""Tests for ML3 structured payload context formatting."""

import json
import unittest

from app.services.ml3.crew_engine import _format_structured_context


ML1_FIXTURE = {
    "chief_complaint": "headache",
    "hpi": {
        "site": "forehead",
        "onset": "2 days ago",
        "severity": 7,
    },
    "allergies": ["penicillin"],
    "medications": ["paracetamol"],
    "source_transcript_refs": ["patient: headache since 2 days"],
}

ML2_FIXTURE = {
    "document_type": "diagnostic_report",
    "medications": [{"name": "aspirin"}],
    "clinical_results": [
        {"test": "Hb", "value": "10.2", "unit": "g/dL", "reference_range": "12-16"}
    ],
}


class Ml3PayloadContextTests(unittest.TestCase):
    def test_flat_payload_unchanged_when_no_structured_blobs(self):
        payload = {
            "chief_complaint": "fever",
            "medications": ["paracetamol"],
            "lab_reports": [],
        }
        text = _format_structured_context(payload)
        parsed = json.loads(text)
        self.assertEqual(parsed["chief_complaint"], "fever")
        self.assertEqual(parsed["medications"], ["paracetamol"])

    def test_structured_sections_when_ml1_ml2_present(self):
        payload = {
            "chief_complaint": "headache",
            "medications": ["paracetamol", "aspirin"],
            "ml1_histories": [ML1_FIXTURE],
            "ml2_documents": [ML2_FIXTURE],
            "lab_reports": [{"panel": "CBC", "clinical_results": []}],
        }
        text = _format_structured_context(payload)

        self.assertIn("ML1: Conversational History", text)
        self.assertIn("ML2: Digitized Medical Documents", text)
        self.assertIn("Merged Flat Fields", text)
        self.assertIn("ML2: Lab Reports", text)
        self.assertIn("headache", text)
        self.assertIn("diagnostic_report", text)

    def test_ml1_only_still_structured(self):
        payload = {
            "chief_complaint": "chest pain",
            "ml1_histories": [ML1_FIXTURE],
        }
        text = _format_structured_context(payload)
        self.assertIn("ML1: Conversational History", text)
        self.assertNotIn("ML2: Digitized Medical Documents", text)

    def test_synthesize_request_accepts_structured_fields(self):
        from app.routers.ml3 import SynthesizeRequest

        body = SynthesizeRequest(
            chief_complaint="headache",
            ml1_histories=[ML1_FIXTURE],
            ml2_documents=[ML2_FIXTURE],
        )
        dumped = body.model_dump()
        self.assertEqual(len(dumped["ml1_histories"]), 1)
        self.assertEqual(len(dumped["ml2_documents"]), 1)
        self.assertEqual(dumped["chief_complaint"], "headache")


if __name__ == "__main__":
    unittest.main()
