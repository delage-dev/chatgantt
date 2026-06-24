# Single-Tenant Server-Side Credentials + One-Click Voice — Design

**Goal:** Move ALL credentials/config to the backend (`.env`), make the app single-tenant, make contacting the voice agent a single click, and remove every in-browser credential/settings form. The multi-tenant / browser-credential model is preserved at branch `legacy/browser-credentials` and tag `v0.1.0-browser-creds`.

## Architecture
The deployment serves one Notion workspace. The backend reads all config from `.env`; the frontend supplies no credentials. The voice agent's tools call ChatGantt's own (server-configured) REST API, so **no secrets travel in the LiveKit JWT**.

## Config contract (`backend/.env`)
| Var | Use |
|---|---|
| `NOTION_TOKEN` | Notion integration token |
| `NOTION_TASKS_DATA_SOURCE` | tasks data-source ID (= `ConnectionConfig.project_key`) |
| `NOTION_BLOCKERS_DATA_SOURCE` | blockers data-source ID (= `extra["blockers_source"]`) |
| `CHAT_PROVIDER` | `anthropic` \| `openai` (default `anthropic`) |
| `CHAT_API_KEY` | server-side LLM key for the chat assistant |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit Cloud (existing) |
| `ANTHROPIC_API_KEY` | voice agent's Claude LLM (existing) |
| `CHATGANTT_API_URL` | agent → REST base (existing, default `http://localhost:8000`) |

If `NOTION_TOKEN` is unset, the backend falls back to the `mock` provider (dev still works).

## Backend
- **`app/settings.py`** (new): typed accessors for the env vars above.
- **`get_connection_config`** (`app/dependencies.py`): build the Notion `ConnectionConfig` from env when `NOTION_TOKEN` is set (provider `notion`, `project_key=NOTION_TASKS_DATA_SOURCE`, `extra={"blockers_source": NOTION_BLOCKERS_DATA_SOURCE}`); else mock. No longer reads creds from request headers.
- **Chat**: the chat endpoint uses `CHAT_PROVIDER`/`CHAT_API_KEY` from env, not a browser-supplied key.

## Voice
- **`POST /api/voice/token`**: request body carries **no secrets** (optional `participant_name`). Mints a JWT with room-join grant + `RoomAgentDispatch(agent_name="chatgantt-voice-agent")` and **no credential attributes**. Returns `{server_url, participant_token}`.
- **`agent/agent.py`**: `load_dotenv()` (load `.env`; keep `.env.local` fallback) — fixes the `ws_url is required` error. Entrypoint no longer reads cred attributes; `ProjectAssistant` is constructed with just `CHATGANTT_API_URL`.
- **`agent/tools.py`**: tool functions call the REST API with **no auth/provider headers** (server-configured). `build_headers` removed/emptied.

## Frontend
- **One-click voice:** mic button → `POST /api/voice/token` (no body) → connect. Show an error toast if the backend returns 500 (voice unconfigured).
- **Remove ALL settings UI:** delete `NotionSettings.tsx`, `ChatSettings.tsx` and their Header buttons; delete the credential `settingsStore`.
- **`utils/api.ts`**: stop sending provider/auth headers (plain requests).
- **Chat**: stop sending a browser LLM key (backend uses env).
- Verify no Twilio/OpenAI-realtime/phone UI remains.

## Out of scope
Multi-tenant / per-user credentials (preserved in `legacy/browser-credentials`); per-project routing; status/health UI (settings removed entirely per decision).

## Parallel tracks (disjoint file ownership)
1. **server-config** — `app/settings.py`, `app/dependencies.py`, chat router/service, tests.
2. **voice** — `app/routers/voice.py`, `agent/agent.py`, `agent/tools.py`, voice/token + tool tests.
3. **frontend** — `frontend/*` (delete settings, one-click voice, drop headers/key).

## Testing
TDD per track: env-based config resolution; token endpoint mints no-secret JWT; tool functions call REST without auth headers; frontend api client sends no cred headers; chat uses env key. Full backend suite + frontend build green before merge.
