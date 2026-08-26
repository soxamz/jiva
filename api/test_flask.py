import urllib.request
import json
import time

print(" Firing payload at Flask ML3 Engine...")

# The exact JSON payload from your teammates
payload = {
  "chief_complaint": "bleeding",
  "hpi": {
    "site": "head",
    "onset": "aaj",
    "character": "boht painful",
    "radiation": "none",
    "associations": "none",
    "time_course": "none",
    "exacerbating_relieving": "none",
    "severity": 10
  },
  "allergies": [],
  "medications": [],
  "comorbidities": [],
  "review_of_systems": {},
  "ayush": None,
  "source_transcript_refs": [
    "i am actually bleeding. Fell from stairs",
    "head",
    "aaj",
    "boht painful",
    "10",
    "no"
  ],
  "red_flags": []
}

# Configure the request to the Flask server
url = "http://127.0.0.1:5328/api/ml3/synthesize"
data = json.dumps(payload).encode("utf-8")
headers = {"Content-Type": "application/json"}
req = urllib.request.Request(url, data=data, headers=headers)

try:
    # 2. Start the high-precision timer right before the network call
    start_time = time.perf_counter() 
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        
        # 3. Stop the timer the millisecond the response arrives
        end_time = time.perf_counter() 
        latency = end_time - start_time
        
        print(f"\n✅ SUCCESS! Flask returned Status {response.status}")
        print(f"⏱️ FRONTEND LATENCY: {latency:.3f} seconds ({latency * 1000:.0f} ms)")
        print("\nHere is the IMMEDIATE triage response the frontend received:")
        print(json.dumps(result, indent=2))
        
        print("\n" + "="*60)
        print("⚠️ STOP! The final physician summary will NOT print here.")
        print("Because the heavy AI processing is now in a background thread,")
        print("switch to your FLASK SERVER TERMINAL (Terminal 1) and wait")
        print("~20 seconds to see the final cut-to-cut Markdown summary.")
        print("="*60 + "\n")
        
except urllib.error.HTTPError as e:
    print(f"\n❌ REQUEST FAILED with status code {e.code}")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"\n❌ REQUEST FAILED: {str(e)}")