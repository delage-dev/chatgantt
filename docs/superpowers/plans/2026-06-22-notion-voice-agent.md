# Notion Backend + LiveKit Voice Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **LiveKit moves fast.** Before implementing any Track B/C task, re-verify the exact API against the `livekit-docs` MCP (`docs_search` / `get_pages` / `get_python_agent_example`). The code here is verified against the docs as of 2026-06-22 but treat it as a starting point, not gospel.

**Goal:** Make Notion the single source of truth for ChatGantt and add a telephony-free (LiveKit/WebRTC) voice agent that reasons over the project and manages Notion-native blockers by voice.

**Architecture:** A new `NotionAdapter` implements the existing `TicketProviderAdapter` protocol so the whole REST API works over Notion data with no route changes. Blockers become a dedicated Notion database (faithful to the rich `Blocker` model). The Twilio telephony voice path is retired and replaced by a **separate LiveKit agent worker process** (STT Deepgram → Claude → TTS Cartesia) whose function-tools call ChatGantt's own REST API; a browser voice pane connects over WebRTC via LiveKit Cloud.

**Tech Stack:** Python 3.10+ / FastAPI, `notion-client`, `httpx`; `livekit-agents~=1.5` (AgentServer, inference STT/TTS, `anthropic` plugin), `livekit-api` (token mint + dispatch); React/TS/Vite, `@livekit/components-react` + `livekit-client`; LiveKit Cloud.

## Global Constraints

- **Zero server-side data storage.** Notion is the source of truth. No DB. Per-session secrets live in process memory only (same as today's Twilio creds in `voice_store`).
- **Provider-agnostic core.** No route in `app/routers/*` may import `notion-client` directly. All Notion access is behind `NotionAdapter`. The voice agent reaches data only through ChatGantt's REST API, never Notion directly.
- **Notion API version header:** `Notion-Version: 2025-09-03` on every Notion request (data-source model). Queries/updates target a **data source ID**, not a database ID.
- **Notion rate limit:** ~3 req/s average. All multi-page reads paginate (`has_more`/`next_cursor`, `page_size<=100`) and honor `Retry-After` on HTTP 429 with backoff. Cap concurrency at 3.
- **Python version floor:** 3.10 (LiveKit Agents requirement). Backend already targets this.
- **Voice agent is a separate process** (`backend/agent/agent.py`), never an in-process FastAPI route.
- **LiveKit model IDs (verify via MCP at impl time):** STT `deepgram/nova-3`; TTS `cartesia/sonic-3`; LLM = Claude via the `anthropic` plugin (`anthropic.LLM(model="claude-sonnet-4-6")`) or `inference.LLM(model="anthropic/<id>")`. Confirm the current Claude model id with the claude-api skill / MCP.
- **TDD, DRY, YAGNI, frequent commits.** Each task ends green.

---

## The Cross-Track Contract (Track 0 locks this; all other tracks consume it)

### Connection config flow
`ConnectionConfig` (unchanged shape) is populated for Notion as:
- `provider = "notion"`
- `access_token` = Notion **internal integration token** (`Bearer` stripped from `Authorization`)
- `project_key` = Notion **tasks data source ID** (the `X-Project` header)
- `base_url` = `"https://api.notion.com"` (default if `X-Base-Url` empty)
- `extra["blockers_source"]` = Notion **blockers data source ID** (from new header `X-Notion-Blockers-Source`)

`app/dependencies.py::get_connection_config` is extended to read `x_notion_blockers_source: str = Header(default="")` and set `extra={"blockers_source": x_notion_blockers_source} if it else {}`.

### Notion schemas (provisioned by Track 0 setup script)
**Tasks data source** properties (names are the contract; types fixed):
`Name`(title) · `Type`(select: Epic/Story/Task) · `Status`(status) · `Timeline`(date range → start/end) · `Due`(date) · `Assignee`(people) · `Parent item`(relation, dual self) · `Sub-items`(relation, synced side) · `Blocked by`(relation→Tasks) · `Description`(rich_text) · `Priority`(select).

**Blockers data source** properties:
`Name`(title, = reason summary) · `Blocked task`(relation→Tasks) · `Blocking task`(relation→Tasks) · `External blocker`(rich_text) · `Reason`(rich_text) · `Severity`(select: low/medium/high) · `Status`(select: active/resolved) · `Created by`(rich_text) · `Created at`(date) · `Resolved at`(date) · `Resolved by`(rich_text) · `Auto resolved`(checkbox).
Blocker page ID ↔ `Blocker.id`. Task page ID ↔ `Ticket.id`.

### REST contract the voice tools consume (already exists; no shape change)
- `GET /api/tasks` → `TicketTree` (headers: `X-Provider`, `X-Project`, `X-Notion-Blockers-Source`, `Authorization`)
- `GET /api/blockers?status=active` → `List[Blocker]`
- `POST /api/blockers` body `BlockerCreate` → `Blocker`
- `POST /api/blockers/{id}/resolve` → `Blocker`
- `GET /api/tasks/{id}/comments`, `POST /api/tasks/{id}/comments`

### Voice session context flow
Browser → `POST /api/voice/token` with `{room_config, participant_identity?}` → backend mints LiveKit JWT with **participant attributes** `{project_id, notion_token, blockers_source}` and a `RoomAgentDispatch(agent_name="chatgantt-voice-agent")`. The agent entrypoint reads those attributes and constructs the `X-Provider/X-Project/Authorization/X-Notion-Blockers-Source` headers its tools send to ChatGantt's REST API. (Token carries secrets only transiently; never persisted.)

### Agent name
`chatgantt-voice-agent` — used in both the worker (`@server.rtc_session(agent_name=...)`) and the frontend `useSession(..., { agentName })` / token `RoomAgentDispatch`.

---

## Decisions baked in (flagged for sign-off)

1. **Blockers = dedicated Notion "ChatGantt Blockers" database** (not a bare self-relation), because the `Blocker` model carries reason/severity/status/created_by/resolved_* that a relation can't hold. Faithful + queryable.
2. **Twilio is retired** — remove `twilio` dep, `app/services/voice_bridge.py`, the `/voice/incoming|pin-verify|stream` routes and `VOICE_PREAMBLE`. Caller/PIN mapping concept is dropped; project context now comes from the web pane. (Reversible only by revert — confirm before Track B.)
3. **LiveKit Cloud** hosting; agent runs as a second process/container alongside FastAPI.
4. **`update_ticket`/`batch_update_tickets` get a minimal real implementation** (date + assignee + description writes) but timeline editing remains a Notion-native activity; `status` stays read-only (the protocol's `TicketUpdate` has no status field).

---

## Track Sequencing

```
Track 0 (contract/foundation)  ── must finish first ──┐
                                                       ▼
   ┌─────────────┬───────────────┬─────────────────┬────────────┐
Track A          Track B          Track C           Track D
NotionAdapter    LiveKit voice    Frontend pane     Infra/config
(parallel)       (parallel)       (parallel)        (parallel)
```
B develops against the **mock** provider first (REST shape is identical), then switches to `X-Provider: notion` once A lands. C needs only the `/api/voice/token` endpoint (Track B Task B2) + the existing REST API.

---

# Track 0 — Contract & Foundation (serial; do first)

### Task 0.1: Notion dependency + client wrapper
**Files:** Create `backend/app/adapters/notion/client.py`; Modify `backend/pyproject.toml` (add `notion-client>=2.2`, `httpx`); Test `backend/tests/adapters/notion/test_client.py`
**Interfaces — Produces:** `NotionClient(token: str, base_url: str)` with async `query_data_source(ds_id, filter=None, sorts=None) -> list[dict]` (auto-paginates), `get_page(page_id) -> dict`, `update_page(page_id, properties: dict) -> dict`, `create_page(parent_ds_id, properties: dict) -> dict`, `list_comments(page_id) -> list[dict]`, `create_comment(page_id, text) -> dict`, `whoami() -> dict`. Sends `Notion-Version: 2025-09-03`; retries 429 with `Retry-After`; concurrency-capped at 3.
- [ ] Write failing test: `query_data_source` paginates two pages (mock httpx with `has_more`/`next_cursor`) and returns combined results; 429 then 200 is retried.
- [ ] Run → fails (no module).
- [ ] Implement with `httpx.AsyncClient`, version header, pagination loop, `asyncio.Semaphore(3)`, 429 backoff.
- [ ] Run → passes. Commit `feat(notion): http client wrapper with pagination + rate-limit`.

### Task 0.2: Property mapping helpers
**Files:** Create `backend/app/adapters/notion/mappers.py`; Test `backend/tests/adapters/notion/test_mappers.py`
**Interfaces — Consumes:** raw Notion page dicts. **Produces:** `page_to_ticket(page) -> Ticket`, `ticket_update_to_props(u: TicketUpdate) -> dict`, `page_to_blocker(page) -> Blocker`, `blocker_create_to_props(b: BlockerCreate, author_id, now_iso) -> dict`, `page_to_comment(c) -> Comment`. Maps the Track-0 schema property names ↔ model fields; `Type` select → `TicketType`; `Timeline` date range → start/end; `Parent item` relation[0] → `parent_id`; `Blocked by` relation → `dependencies`.
- [ ] Failing tests for each mapper using captured Notion JSON fixtures (one per property type).
- [ ] Implement pure functions (no I/O).
- [ ] Pass. Commit `feat(notion): page<->model property mappers`.

### Task 0.3: Extend connection config for blockers source
**Files:** Modify `backend/app/dependencies.py:12-31`; Modify `backend/app/models/tickets.py` (confirm `ConnectionConfig.extra: dict` exists); Test `backend/tests/test_dependencies.py`
**Interfaces — Produces:** `get_connection_config` now reads `x_notion_blockers_source` header → `config.extra["blockers_source"]`.
- [ ] Failing test: header present → `config.extra["blockers_source"] == "<id>"`; absent → `extra == {}`.
- [ ] Implement. Pass. Commit `feat(config): X-Notion-Blockers-Source header`.

### Task 0.4: Schema provisioning script
**Files:** Create `backend/scripts/provision_notion.py`; Doc `backend/scripts/README.md`
**Interfaces — Produces:** CLI `uv run python -m scripts.provision_notion --token <t> --parent-page <id>` that creates the Tasks + Blockers data sources per the Track-0 schema and prints their IDs. Uses `POST /v1/databases` (status options pre-created where API can't). Idempotent guard: refuse if a DB with the same title exists under the parent.
- [ ] Manual-run script (no unit test; it hits real Notion). Include a `--dry-run` that prints the property JSON.
- [ ] Commit `feat(notion): provisioning script for tasks+blockers data sources`.

---

# Track A — NotionAdapter (parallel after Track 0)

> Template: `backend/app/adapters/mock_adapter.py`. Protocol: `backend/app/adapters/base.py` (13 methods). Register in `backend/app/adapters/registry.py`.

### Task A.1: Skeleton + registration + `test_connection`
**Files:** Create `backend/app/adapters/notion_adapter.py`; Modify `backend/app/adapters/registry.py:_ADAPTERS`; Test `backend/tests/adapters/test_notion_adapter.py`
**Interfaces — Consumes:** `NotionClient` (0.1), mappers (0.2). **Produces:** `class NotionAdapter` satisfying `TicketProviderAdapter`; registered as `"notion"`. `test_connection` calls `client.whoami()`.
- [ ] Failing test: `get_adapter("notion")` returns a `NotionAdapter`; `isinstance(NotionAdapter(), TicketProviderAdapter)` (runtime_checkable) is True; `test_connection` true on mocked `whoami`.
- [ ] Implement skeleton raising `NotImplementedError` for unfinished methods + register.
- [ ] Pass. Commit `feat(notion): adapter skeleton + registration`.

### Task A.2: `get_project_tree` + `get_ticket`
**Interfaces — Produces:** reads the tasks data source (`config.project_key`), maps pages → `Ticket`, assembles flat `TicketTree`; resolves `Blocked by` → `dependencies`.
- [ ] Failing test with mocked `query_data_source` returning 3 pages (epic/story/task) → tree with correct `parent_id` links + dependencies.
- [ ] Implement. Pass. Commit `feat(notion): project tree + single ticket reads`.

### Task A.3: Notion-native blockers (the differentiator)
**Files:** same adapter; Test additions.
**Interfaces — Produces:** `list_blockers(status?)`, `get_task_blockers(ticket_id)`, `create_blocker`, `resolve_blocker`, `delete_blocker`, `auto_resolve_blockers_for` — all backed by the **Blockers data source** (`config.extra["blockers_source"]`). `create_blocker` validates referenced task IDs exist (query Tasks). `resolve_blocker` patches `Status`→resolved, `Resolved at`, `Resolved by`. `auto_resolve_blockers_for` queries active blockers where `Blocking task` relation contains `ticket_id`.
- [ ] Failing tests per method (mocked client): create writes correct props; resolve patches status; auto-resolve filters by blocking relation; `BlockerCreate` validation error path.
- [ ] Implement. Pass. Commit `feat(notion): Notion-native blocker CRUD`.

### Task A.4: Comments + `update_ticket`/`batch_update_tickets`
**Interfaces — Produces:** `get_ticket_comments`/`create_comment` via Notion Comments API; `update_ticket` patches Timeline/Due/Assignee/Description/`Parent item`/`Blocked by`; `batch_update_tickets` = throttled per-page PATCH loop returning failed IDs.
- [ ] Failing tests: comment round-trip; update maps `TicketUpdate`→props; batch collects failures.
- [ ] Implement. Pass. Commit `feat(notion): comments + ticket updates`.

### Task A.5: Integration smoke test (gated)
**Files:** `backend/tests/adapters/test_notion_live.py` (marked `@pytest.mark.live`, skipped without `NOTION_TEST_TOKEN`).
- [ ] Against a real throwaway Notion workspace: provision → tree → create/resolve blocker → comment. Document in README. Commit `test(notion): gated live smoke test`.

---

# Track B — LiveKit Voice Agent (parallel after Track 0; retires Twilio)

### Task B.1: Retire Twilio voice path
**Files:** Delete `backend/app/services/voice_bridge.py`; Modify `backend/app/routers/voice.py` (remove `/voice/incoming`,`/voice/pin-verify`,`/voice/stream`, `VOICE_PREAMBLE`, Twilio imports, caller/PIN routes); Modify `backend/pyproject.toml` (drop `twilio`); Modify `backend/app/services/voice_store.py` (drop caller/PIN, keep a `set_config/get_config` for LiveKit creds if needed); Tests updated.
- [ ] Update/remove tests referencing Twilio; run suite → green (telephony gone).
- [ ] Commit `refactor(voice): retire Twilio telephony path`.

### Task B.2: `/api/voice/token` endpoint
**Files:** Modify `backend/app/routers/voice.py`; Modify `backend/pyproject.toml` (add `livekit-api~=0.8`); Test `backend/tests/routers/test_voice_token.py`
**Interfaces — Consumes:** env `LIVEKIT_URL/API_KEY/API_SECRET`. **Produces:** `POST /api/voice/token` returns `{server_url, participant_token}` (201). Mints `AccessToken` with identity, `VideoGrants(room_join, room, can_publish, can_subscribe)`, `with_attributes({project_id, notion_token, blockers_source})`, and `with_room_config(RoomConfiguration(agents=[RoomAgentDispatch(agent_name="chatgantt-voice-agent", ...)]))`. Project/Notion config supplied by request body (from the pane), held only in the minted JWT.
- [ ] Failing test: posting a body returns 201 with a decodable JWT containing the room grant + attributes (decode with the secret).
- [ ] Implement. Pass. Commit `feat(voice): LiveKit token endpoint`.

### Task B.3: Agent worker + pipeline
**Files:** Create `backend/agent/agent.py`, `backend/agent/__init__.py`, `backend/agent/.env.local.example`; Modify `backend/pyproject.toml` (add `livekit-agents[anthropic,deepgram,cartesia,silero]~=1.5`, `python-dotenv`)
**Interfaces — Consumes:** Track-0 REST contract. **Produces:** `AgentServer` + `@server.rtc_session(agent_name="chatgantt-voice-agent")` entrypoint; `AgentSession(stt=inference.STT("deepgram/nova-3"), llm=anthropic.LLM(model=<claude>), tts=inference.TTS("cartesia/sonic-3"), turn_handling=TurnHandlingOptions(turn_detection=inference.TurnDetector()))`; `ProjectAssistant(Agent)` reads `participant.attributes` for `{project_id, notion_token, blockers_source}` and builds REST headers.
- [ ] Verify current API via `livekit-docs` MCP (`/agents/start/voice-ai`, `/agents/server/job`).
- [ ] Add `console`-mode manual check note (no automated WebRTC test). Commit `feat(voice): LiveKit agent worker (STT→Claude→TTS)`.

### Task B.4: Agent function-tools → ChatGantt REST
**Files:** Create `backend/agent/tools.py`; Test `backend/tests/agent/test_tools.py` (unit-test the HTTP-calling functions with mocked httpx, independent of LiveKit runtime)
**Interfaces — Produces:** `@function_tool` async tools on `ProjectAssistant`: `get_project_overview()` (GET /api/tasks → spoken summary), `list_active_blockers()`, `create_blocker(blocked_task, reason, severity)` (POST /api/blockers; `context.disallow_interruptions()`), `relate_to_project(query)` (reads tree, lets Claude reason). Each builds headers `{X-Provider: notion, X-Project: project_id, Authorization: Bearer notion_token, X-Notion-Blockers-Source: blockers_source}`; returns concise speech-friendly text; `raise ToolError(...)` on HTTP error.
- [ ] Failing tests: each tool function hits the right URL with the right headers and returns expected text (mock httpx).
- [ ] Implement. Pass. Commit `feat(voice): project/blocker function-tools over REST`.

---

# Track C — Frontend Voice Pane (parallel; needs B.2 token endpoint)

### Task C.1: Client deps + provider header wiring
**Files:** Modify `frontend/package.json` (`@livekit/components-react`, `@livekit/components-styles`, `livekit-client`); Modify `frontend/src/lib/api.ts` (send `X-Provider`/`X-Project`/`X-Notion-Blockers-Source`/`Authorization` from a settings store instead of hardcoded `mock`/`DEMO`); Test `frontend/src/lib/api.test.ts`
**Interfaces — Produces:** API client reads provider config (Notion token + data-source IDs) from a frontend settings store; falls back to mock when unset.
- [ ] Failing test: api client attaches configured headers.
- [ ] Implement + `npm install`. Pass. Commit `feat(fe): provider header wiring + livekit deps`.

### Task C.2: Voice pane component
**Files:** Create `frontend/src/components/VoicePane.tsx`, `frontend/src/components/VoiceAgentView.tsx`; mount in app shell (replace old Twilio voice UI / phone-icon modal).
**Interfaces — Consumes:** `POST /api/voice/token` (B.2). **Produces:** `useSession(TokenSource.endpoint('/api/voice/token'), { agentName: 'chatgantt-voice-agent' })` inside `SessionProvider`; `RoomAudioRenderer`; start/stop button (`session.start()/end()`); `useAgent()` state label + `BarVisualizer` driven by `agent.microphoneTrack`+`agent.state`; mic-only (`camera:false`).
- [ ] Verify component API via `livekit-docs` MCP (`/frontends/build/sessions`, `useAgent`, `BarVisualizer`).
- [ ] Manual browser check against a running agent. Commit `feat(fe): LiveKit voice pane`.

### Task C.3: Remove Twilio voice settings UI
**Files:** Modify/remove the phone-icon voice settings modal + Twilio credential fields + caller-mapping UI.
- [ ] Replace with LiveKit/Notion connection settings (Notion token + tasks/blockers data-source IDs). Build passes. Commit `refactor(fe): replace Twilio voice UI with LiveKit/Notion settings`.

---

# Track D — Infra / Config (parallel)

### Task D.1: LiveKit Cloud + env
**Files:** Create `backend/.env.example` additions, `backend/agent/.env.local.example`; Modify `GETTING_STARTED.md` (replace Twilio voice section with LiveKit Cloud setup: `lk cloud auth`, project keys `LIVEKIT_URL/API_KEY/API_SECRET`, `ANTHROPIC_API_KEY`).
- [ ] Document free-tier limits (1,000 agent-min/mo, 5 concurrent). Commit `docs: LiveKit Cloud setup`.

### Task D.2: Two-process run + deploy
**Files:** Modify `docker-compose.yml` (add `agent` service: `python -m agent.agent start`); Modify `backend/Dockerfile` if needed; note LiveKit Cloud `lk agent create` as the managed alternative.
- [ ] `docker compose config` valid; document `uv run python -m agent.agent dev` for local. Commit `chore: api+agent two-process deployment`.

---

## Self-Review

**Spec coverage:** Notion backend → Track A. Notion-native blockers → A.3 + Track 0 schema. Telephony-free LiveKit voice → Track B. Reason/relate to projects → B.4 tools + Claude. Worktrees/agent-teams → process (this plan executes in `worktree-notion-voice` via subagent teams). Calendar/Mail/Chat → **explicitly out of scope** for this plan (separate future plans per the research).

**Placeholder scan:** Live Notion/WebRTC tasks (0.4, A.5, B.3, C.2) are manual-verify by nature and say so; all unit-testable tasks carry concrete test intent. No "TBD".

**Type consistency:** `Ticket`/`TicketUpdate`/`Comment`/`Blocker`/`BlockerCreate`/`ConnectionConfig` used exactly as defined in `app/models`. Agent name string `chatgantt-voice-agent` consistent across B.2/B.3/C.2. Notion property names consistent between Track 0 schema, mappers (0.2), and adapter (A.*).

**Open risks to validate during impl:** (1) LiveKit `anthropic` plugin model id — confirm current Claude id; (2) whether `inference.LLM("anthropic/...")` is preferable to the `anthropic` plugin for billing; (3) Notion `status` options can't be API-created — provisioning script must use `select` or pre-created options; (4) comment retrieval limited to open comments.
