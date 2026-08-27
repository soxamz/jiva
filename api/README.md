# JivaHQ — Clinical Conversational Intake

Hybrid CrewAI intake engine for JivaHQ:

- **TurnCrew (Groq `llama-3.1-8b-instant`)**: adaptive SOCRATES questioning
- **Rule red flags**: primary emergency gate (EN + Hinglish patterns)
- **CloseCrew (Gemini `gemini-3.6-flash`)**: structured history + bilingual draft summary
- **ASR**: Groq Whisper for voice turns
- **UI**: Next.js `/intake` chat

Clinical text is processed by **Groq** (turns/ASR) and **Google** (finalize). Strip PII before prompts where possible (DPDP stub).

## Prerequisites

- Node / Bun for the frontend
- **Python 3.10–3.13** for the API (CrewAI does not support 3.14 yet; 3.13 recommended)
- `GROQ_API_KEY` and `GEMINI_API_KEY`

```bash
# Example with Anaconda / any 3.13 interpreter
# C:\Users\...\python.exe -m venv .venv
py -3.10 -m venv .venv   # or another 3.10–3.13 runtime
```

## Backend setup

```bash
cd api
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # then fill API keys (Windows)
# cp .env.example .env   # macOS / Linux
```

Run the API (port **5328**, matches Next rewrite):

```bash
cd api
uvicorn main:app --host 127.0.0.1 --port 5328 --reload --reload-exclude "runtime/*" --reload-exclude "*.json"
```

Health check: [http://127.0.0.1:5328/api/health](http://127.0.0.1:5328/api/health)

Red-flag unit tests (no API keys needed):

```bash
cd api
python -m unittest tests.test_red_flags -v
```

## Frontend setup

From the project root (`jiva-master/`):

```bash
bun install
bun dev
```

Open [http://localhost:3000/intake](http://localhost:3000/intake).

Next.js rewrites `/api/*` → `http://127.0.0.1:5328/api/*` (see `next.config.ts`).

## API surface

| Method | Path                                 | Purpose                                   |
| ------ | ------------------------------------ | ----------------------------------------- |
| POST   | `/api/intake/sessions`               | Start session                             |
| POST   | `/api/intake/sessions/{id}/turn`     | JSON `{text}` or multipart `audio`/`text` |
| POST   | `/api/intake/sessions/{id}/finalize` | CloseCrew → history + draft summary       |
| GET    | `/api/intake/sessions/{id}`          | Session state                             |
| GET    | `/api/health`                        | Health + model config                     |

## Notes

- Summaries are **drafts** for clinician verification — not diagnoses.
- Rule hits force `bypass_queue`; LLM triage can only escalate, never clear a rule emergency.
- Agents/crews are created **per request**.
