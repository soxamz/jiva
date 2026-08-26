import urllib.request
import json
import time

print("Firing Merged ML1 + ML2 Payload at Flask ML3 Engine...")

# The Ultimate Merged Payload (Exactly what the Next.js frontend should send)
payload = {
    # REPLACE THIS WITH A REAL UUID FROM YOUR DATABASE TO TEST THE DB INSERT
    "patient_id": "11111111-1111-4111-8111-111111111111", 
    "chief_complaint": "i am having loose motion",
    "hpi": {
        "site": "Abdomen",
        "onset": "last 3 days",
        "character": "Loose watery stools",
        "radiation": None,
        "associations": "pani jesa stool",
        "time_course": "lagatar. specifically Today had 4 times",
        "exacerbating_relieving": None,
        "severity": 8
    },
    "allergies": [],
    "medications": ["Pantop DSR"], # Fixed from ML1's "prior_medications"
    "comorbidities": [],
    "ayush": {
        "prakriti": "normal as usual",
        "vikriti": "usually have normal stool excretion. now having excessive stool excression wobhi pani jesa stool",
        "sattva": "mild moderate exercise everyday, no stress",
        "vaya": "20 years"
    },
    # ML 2 OCR DATA INJECTED HERE
    "lab_reports": [
        {
            "panel": "LIVER FUNCTION TEST",
            "clinical_results": [
                {
                    "test": "SERUM BILIRUBIN (TOTAL)",
                    "value": 1.22,
                    "unit": "mg/dL",
                    "reference_range": "0.2-1.2"
                },
                {
                    "test": "SERUM SGOT",
                    "value": 20.0,
                    "unit": "U/L",
                    "reference_range": "0.0-40.0"
                },
                {
                    "test": "SERUM SGPT",
                    "value": 22.5,
                    "unit": "U/L",
                    "reference_range": "5.0-40.0"
                }
            ]
        }
    ],
    "source_transcript_refs": [
        "i am having loose motion",
        "last 3din sh",
        "pani jesa stool",
        "lagatar. specifically Today had 4 times",
        "Pantop DSR"
    ],
    "red_flags": []
}

# Configure the request to the Flask server
url = "http://127.0.0.1:5328/api/ml3/synthesize"
data = json.dumps(payload).encode("utf-8")
headers = {"Content-Type": "application/json"}
req = urllib.request.Request(url, data=data, headers=headers)

try:
    start_time = time.perf_counter() 
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        latency = time.perf_counter() - start_time
        
        print(f"\n✅ SUCCESS! Flask returned Status {response.status}")
        print(f"⏱️ FRONTEND LATENCY: {latency:.3f} seconds ({latency * 1000:.0f} ms)")
        print("\nHere is the IMMEDIATE triage response:")
        print(json.dumps(result, indent=2))
        
        print("\n" + "="*60)
        print("⚠️ STOP! Switch to your FLASK SERVER TERMINAL (Terminal 1).")
        print("Wait ~20 seconds. If you used a dummy patient_id, the database save")
        print("will fail and throw an error, BUT the CrewAI summary will still print!")
        print("Check if it successfully combined the loose motion + Bilirubin.")
        print("="*60 + "\n")
        
except urllib.error.HTTPError as e:
    print(f"\n❌ REQUEST FAILED with status code {e.code}")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"\n❌ REQUEST FAILED: {str(e)}")