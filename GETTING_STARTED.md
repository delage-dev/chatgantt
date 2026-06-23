# Getting Started with ChatGantt in Microsoft Teams

This guide walks through deploying ChatGantt, connecting it to your ticketing system, configuring API keys, and embedding it as a Teams tab.

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Microsoft Teams workspace with admin permissions
- A LiveKit Cloud account (for in-browser voice features — see section 4)
- An Anthropic API key (for the AI chat assistant and voice agent)
- Access credentials for your ticketing system (Notion, Jira, Linear, etc.)

---

## 1. Build and Run ChatGantt

### Clone and install

```bash
git clone <your-repo-url> chatgantt
cd chatgantt

# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Build the frontend

```bash
cd frontend
npm run build
```

This outputs production files to `frontend/dist`. The backend automatically serves these in production mode.

### Start the server

ChatGantt runs as two processes: the FastAPI API server and the LiveKit voice agent worker.

```bash
# Terminal 1 — API server
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The app is now running at `http://localhost:8000`. The backend serves both the API (`/api/*`) and the built frontend (everything else).

```bash
# Terminal 2 — LiveKit voice agent worker (requires .env with LIVEKIT_* + ANTHROPIC_API_KEY)
cd backend
uv run python -m agent.agent dev
```

The agent worker dials out to LiveKit Cloud — no inbound port needed.

For development with hot-reload, add a third terminal for the frontend:

```bash
# Terminal 3 — frontend dev server
cd frontend
npm run dev
```

The frontend dev server runs on port 5173 and proxies API requests to the backend.

### Run with Docker Compose

```bash
cp backend/.env.example backend/.env
# edit backend/.env with real keys
docker compose up
```

This starts `api` (port 8000), `agent` (no exposed port — dials LiveKit Cloud), and `frontend` (port 5173).

### Verify the app is running

```bash
curl http://localhost:8000/api/health
```

---

## 2. Connect Your Ticketing System

ChatGantt uses a stateless pass-through architecture. It does not store your tickets — it reads and writes them through your ticketing provider's API in real time. Connection details are passed via HTTP headers on every request.

### Required headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-Provider` | Ticketing provider name | `jira`, `linear`, `mock` |
| `X-Project` | Project key or identifier | `PROJ-1`, `DEMO` |
| `X-Base-Url` | Provider API base URL | `https://yourcompany.atlassian.net` |
| `Authorization` | Bearer token for the provider API | `Bearer eyJ...` |

When no headers are provided, the app defaults to the built-in mock provider with sample data — useful for trying things out before connecting a real system.

### How headers are injected

In a Teams deployment, these headers are injected by the reverse proxy or bot framework sitting between Teams and ChatGantt. The user never sees or manages them directly. See [section 5](#5-embed-in-microsoft-teams) for the Teams-specific setup.

### Implementing a provider adapter

ChatGantt supports pluggable provider adapters. To connect a new ticketing system, implement the `TicketProviderAdapter` protocol:

```python
# backend/app/adapters/your_provider_adapter.py

class YourProviderAdapter:
    async def get_project_tree(self, config) -> TicketTree:
        """Fetch the full epic → story → task hierarchy."""
        ...

    async def get_ticket(self, config, ticket_id) -> Ticket:
        """Fetch a single ticket."""
        ...

    async def update_ticket(self, config, ticket_id, updates) -> Ticket:
        """Apply field updates (dates, description, dependencies, etc.)."""
        ...

    async def batch_update_tickets(self, config, updates) -> list[str]:
        """Update multiple tickets. Return IDs that failed."""
        ...

    async def get_ticket_comments(self, config, ticket_id) -> list[Comment]:
        """Fetch comments on a ticket."""
        ...

    async def create_comment(self, config, ticket_id, content, author_id) -> Comment:
        """Post a new comment."""
        ...

    async def test_connection(self, config) -> bool:
        """Verify credentials work."""
        ...
```

Register it in `backend/app/adapters/registry.py`:

```python
from app.adapters.your_provider_adapter import YourProviderAdapter

register_adapter("your_provider", YourProviderAdapter())
```

Then set `X-Provider: your_provider` in the request headers.

### Test the connection

```bash
curl -H "X-Provider: your_provider" \
     -H "X-Project: YOUR_PROJECT" \
     -H "X-Base-Url: https://your-provider-api.com" \
     -H "Authorization: Bearer your-token" \
     http://localhost:8000/api/tasks
```

You should see your project's ticket hierarchy in the response.

---

## 3. Configure the AI Chat Assistant

The chat assistant uses Anthropic Claude or OpenAI GPT to answer questions about your project. It has full awareness of your task hierarchy, statuses, assignees, and dates.

### Set up via the UI

1. Open ChatGantt in your browser
2. Click the chat bubble icon (bottom-right corner)
3. Click the settings gear icon in the chat panel header
4. Select your provider (Claude or GPT)
5. Enter your API key
6. Click Save

The API key is stored in your browser's localStorage and sent per-request. It is never saved on the server.

### Supported providers

| Provider | Model | Key format |
|----------|-------|------------|
| Anthropic | claude-sonnet-4 | `sk-ant-...` |
| OpenAI | gpt-4o | `sk-...` |

---

## 4. Configure Voice (LiveKit Cloud)

The voice feature uses a WebRTC browser session — no phone number or telephony required. The user clicks a microphone button in the ChatGantt voice pane, which connects to a LiveKit room where the AI agent is already waiting. Speech recognition (Deepgram), reasoning (Claude), and text-to-speech (Cartesia) all run inside the agent worker process.

### What you need

- A **LiveKit Cloud** account and project — sign up at [cloud.livekit.io](https://cloud.livekit.io) (free tier: ~1,000 agent-minutes/month, 5 concurrent sessions)
- Your **LIVEKIT_URL**, **LIVEKIT_API_KEY**, and **LIVEKIT_API_SECRET** (from the LiveKit Cloud dashboard → Settings → Keys)
- An **ANTHROPIC_API_KEY** (same key used for the chat assistant is fine)

### Step 1: Authenticate with LiveKit Cloud

```bash
lk cloud auth
```

This opens a browser for OAuth login and stores credentials locally. Optional for self-hosted; required if you want to use `lk agent create` for managed worker deployment.

### Step 2: Set environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env:
#   LIVEKIT_URL=wss://your-project.livekit.cloud
#   LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxx
#   LIVEKIT_API_SECRET=your-livekit-api-secret
#   ANTHROPIC_API_KEY=sk-ant-...
```

### Step 3: Start the agent worker

```bash
cd backend
uv run python -m agent.agent dev
```

The worker registers itself with LiveKit Cloud under the name `chatgantt-voice-agent`. When the browser voice pane requests a session, LiveKit dispatches the call to this worker. No inbound port or webhook is needed — the agent dials out over WebSocket.

For production (Docker Compose), the `agent` service in `docker-compose.yml` runs `python -m agent.agent start` automatically alongside the API.

### Step 4: Provision Notion data sources

The voice agent reasons over your project data by calling the ChatGantt REST API, which in turn reads from Notion. Before starting a voice session, provision the required Notion data sources:

```bash
cd backend
uv run python -m scripts.provision_notion --token secret_xxx --parent-page <page_id> --dry-run
# inspect the output, then:
uv run python -m scripts.provision_notion --token secret_xxx --parent-page <page_id> --apply
```

The `--apply` run prints the header values to configure in the voice pane:

```
X-Provider: notion
X-Project: <tasks_data_source_id>
X-Notion-Blockers-Source: <blockers_data_source_id>
Authorization: Bearer secret_xxx
```

See `backend/scripts/README.md` for full details and caveats on the Notion data-source API.

### Step 5: Use the voice pane

1. Open ChatGantt in your browser
2. Click the microphone icon in the header bar
3. Enter your Notion integration token and the data-source IDs from the provisioning step
4. Click **Connect** — the browser connects to LiveKit via WebRTC

No phone number is required. There is no PIN system. Project context flows from the voice pane settings into the LiveKit room as participant attributes, which the agent picks up at session start.

### Free-tier limits

| Limit | Value |
|-------|-------|
| Agent-minutes per month | ~1,000 (varies by plan) |
| Concurrent agent sessions | 5 |
| Room participants | Unlimited on paid; 2 on free |

Upgrade at [cloud.livekit.io](https://cloud.livekit.io/settings/billing) when you exceed the free tier.

---

## 5. Embed in Microsoft Teams

ChatGantt runs as a Teams tab application. The frontend loads in an iframe, and a reverse proxy or bot framework injects the connection headers. Voice now runs entirely in-browser via LiveKit WebRTC — no telephony, no phone numbers, no Twilio webhook configuration needed in Teams.

### Architecture overview

```
Teams Tab (iframe)
  └─→ Reverse Proxy / Azure Bot Service
        ├─ Injects X-Provider, X-Project, X-Base-Url, Authorization headers
        ├─ Injects X-User-Id, X-User-Name, X-User-Role from Teams SSO
        └─→ ChatGantt Backend (FastAPI)
```

### Step 1: Deploy ChatGantt to a public URL

Deploy the app to your hosting environment (Azure App Service, AWS, Docker, etc.). The server must be reachable via HTTPS — Teams requires it.

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Start production server
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 2: Update CORS origins

Edit `backend/app/main.py` to allow your Teams origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://teams.microsoft.com",
        "https://<your-tenant>.sharepoint.com",
        "https://your-chatgantt-domain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Step 3: Set up a reverse proxy

The reverse proxy sits between Teams and ChatGantt. It handles Teams SSO token validation and injects the connection headers your ticketing provider needs.

Example nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name chatgantt.your-company.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Inject ticketing provider headers
        proxy_set_header X-Provider "jira";
        proxy_set_header X-Project "PROJ-1";
        proxy_set_header X-Base-Url "https://yourcompany.atlassian.net";
        proxy_set_header Authorization "Bearer <provider-api-token>";

        # Inject user identity from Teams SSO (populated by auth middleware)
        proxy_set_header X-User-Id $teams_user_id;
        proxy_set_header X-User-Name $teams_user_name;
        proxy_set_header X-User-Role $teams_user_role;

        # WebSocket support (for voice streaming)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

For per-channel configuration (different projects per Teams channel), use a mapping table or Azure Bot Framework to resolve the channel ID to the appropriate provider, project, and credentials.

### Step 4: Create the Teams app manifest

Create a Teams app package with a `manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "<generate-a-guid>",
  "name": { "short": "ChatGantt", "full": "ChatGantt Project Viewer" },
  "description": {
    "short": "Gantt chart with AI assistant",
    "full": "Interactive Gantt chart viewer with AI-powered project briefings and voice calling."
  },
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://your-domain.com",
    "privacyUrl": "https://your-domain.com/privacy",
    "termsOfUseUrl": "https://your-domain.com/terms"
  },
  "staticTabs": [
    {
      "entityId": "chatgantt",
      "name": "Gantt Chart",
      "contentUrl": "https://chatgantt.your-company.com",
      "scopes": ["personal", "team"]
    }
  ],
  "configurableTabs": [
    {
      "configurationUrl": "https://chatgantt.your-company.com/config",
      "canUpdateConfiguration": true,
      "scopes": ["team", "groupChat"]
    }
  ],
  "permissions": ["identity"],
  "validDomains": ["chatgantt.your-company.com"]
}
```

Package the manifest with two icon files (color and outline) into a `.zip` and upload it via the Teams Admin Center or sideload it for development.

### Step 5: Configure per-channel settings

Each Teams channel can map to a different project. The reverse proxy or bot framework resolves which project and provider to use based on the Teams channel ID.

For simple deployments, hardcode the provider headers in the proxy. For multi-project setups, use the Teams [tab configuration page](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/create-tab-pages/configuration-page) to let channel admins select their project and enter provider credentials during tab installation.

---

## 6. Permissions

ChatGantt supports two roles: **editor** (full access) and **viewer** (read-only, can comment).

Permissions are controlled by the `X-User-Role` header. When no header is provided, the app defaults to editor — ensuring it works out of the box without any identity system.

| Role | Can view | Can comment | Can edit (drag, reorder, update) |
|------|----------|-------------|----------------------------------|
| Editor | Yes | Yes | Yes |
| Viewer | Yes | Yes | No |

In a Teams deployment, the reverse proxy sets `X-User-Role` based on the user's Teams role or a custom mapping.

To verify your role:

```bash
curl -H "X-User-Role: viewer" http://localhost:8000/api/me
# Returns: {"user_id":"anonymous","display_name":"Anonymous","role":"viewer"}
```

---

## 7. API Key Summary

| Key | Where configured | Storage | Purpose |
|-----|-----------------|---------|---------|
| Notion integration token | Voice pane settings / reverse proxy `Authorization` header | Browser session / proxy config | Read/write Notion tasks and blockers |
| Notion data-source IDs | Voice pane settings (`X-Project`, `X-Notion-Blockers-Source`) | Browser session | Identify which Notion databases to use |
| Chat LLM API key | Chat settings UI (gear icon in chat panel) | Browser localStorage | AI chat assistant (Claude or GPT) |
| `LIVEKIT_URL` | `backend/.env` | Server env var | LiveKit Cloud project endpoint |
| `LIVEKIT_API_KEY` | `backend/.env` | Server env var | LiveKit token minting (API server) |
| `LIVEKIT_API_SECRET` | `backend/.env` | Server env var | LiveKit token signing (API server) |
| `ANTHROPIC_API_KEY` | `backend/.env` | Server env var | Claude LLM inside the voice agent worker |

**Data residency:** No user data or secrets are written to disk by ChatGantt. Notion credentials flow per-request via headers. LiveKit and Anthropic keys live in server environment variables (your `.env` file, outside the app). Nothing is stored in a database.

---

## Troubleshooting

**App loads but shows no tasks**
- Check that `X-Provider` and `X-Project` headers are being sent. Without them, the app uses the mock provider with demo data.
- Verify your provider adapter is registered and `test_connection()` passes.

**Chat assistant doesn't respond**
- Open chat settings and verify your API key is entered.
- Check the browser console for errors (401 = invalid key, 502 = provider error).

**Voice pane does not connect**
- Check that the agent worker is running (`uv run python -m agent.agent dev` in the `backend/` directory). The API server alone is not enough.
- Verify `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are set correctly in `backend/.env`.
- Open the browser console — a 401 from `/api/voice/token` means the LiveKit credentials are missing or wrong; a WebRTC ICE failure means a network/firewall issue with the LiveKit Cloud endpoint.

**Voice agent connects but has no project data**
- Ensure you have entered the Notion integration token and data-source IDs in the voice pane settings.
- Run the provisioning script (`backend/scripts/README.md`) to create the Tasks and Blockers databases if you haven't already.

**Permission denied (403) on edits**
- Check that `X-User-Role` is set to `editor` (or not set at all — the default is editor).

**Tasks not updating after drag**
- Check the browser console for API errors. The app optimistically updates the UI and rolls back on failure.
- Verify your provider token has write permissions.
