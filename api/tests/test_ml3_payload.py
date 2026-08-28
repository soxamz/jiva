"""Tests for ML3 structured payload context formatting."""

import json
import unittest

from app.services.ml3.crew_engine import _format_structured_context


class Ml3PayloadContextTests(unittest.TestCase):
    def test_flat_payload_remains_json_without_structured_sources(self):
        payload = {"chief_complaint": "fever", "medications": ["paracetamol"]}

        context = _format_structured_context(payload)

        self.assertEqual(json.loads(context), payload)

    def test_labels_ml1_and_ml2_sources_for_the_crew(self):
        context = _format_structured_context(
            {
                "chief_complaint": "headache",
                "ml1_histories": [{"chief_complaint": "headache"}],
                "ml2_documents": [{"document_type": "diagnostic_report"}],
            }
        )

        self.assertIn("ML1: Conversational History", context)
        self.assertIn("Merged Flat Fields", context)
        self.assertIn("ML2: Digitized Medical Documents", context)

    def test_synthesis_request_accepts_structured_sources(self):
        from app.routers.ml3 import SynthesizeRequest

        request = SynthesizeRequest(
            chief_complaint="headache",
            ml1_histories=[{"chief_complaint": "headache"}],
            ml2_documents=[{"document_type": "diagnostic_report"}],
        )

        payload = request.model_dump()
        self.assertEqual(len(payload["ml1_histories"]), 1)
        self.assertEqual(len(payload["ml2_documents"]), 1)


if __name__ == "__main__":
    unittest.main()
