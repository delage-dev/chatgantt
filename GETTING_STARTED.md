# Getting Started with ChatGantt in Microsoft Teams

This guide walks through deploying ChatGantt, connecting it to your ticketing system, configuring API keys, and embedding it as a Teams tab.

---

## Prerequisites

- Python 3.9+
- Node.js 18+
- A Microsoft Teams workspace with admin permissions
- A Twilio account (for voice calling features)
- An API key from Anthropic or OpenAI (for the AI chat assistant)
- An OpenAI API key with Realtime API access (for voice features)
- Access credentials for your ticketing system (Jira, Linear, etc.)

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

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The app is now running at `http://localhost:8000`. The backend serves both the API (`/api/*`) and the built frontend (everything else).

For development with hot-reload, run the backend and frontend separately:

```bash
# Terminal 1 — backend
cd backend
CHATGANTT_ENV=dev uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend dev server
cd frontend
npm run dev
```

The frontend dev server runs on port 5173 and proxies API requests to the backend.

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

## 4. Configure Voice Calling

The voice feature lets users dial a phone number and have a spoken conversation with the AI assistant about project status. It uses Twilio for phone connectivity and OpenAI's Realtime API for voice-to-voice conversation.

### What you need

- A **Twilio account** with a phone number that supports voice
- Your **Twilio Account SID** and **Auth Token** (from the Twilio console)
- An **OpenAI API key** with access to the Realtime API (`gpt-4o-realtime-preview`)

### Set up via the UI

1. Click the phone icon in the header bar
2. Enter your Twilio Account SID, Auth Token, and phone number
3. Enter your OpenAI API key (this is separate from the chat API key)
4. Click **Save Credentials**

These credentials are held in server memory only. They are never written to disk. If the server restarts, you will need to re-enter them.

### Register caller ID mappings

So the system knows who is calling and which project to brief them on:

1. In the Voice Settings modal, scroll to **Caller ID Mappings**
2. Enter the caller's phone number (E.164 format, e.g., `+15551234567`)
3. Enter their name and project key
4. Optionally assign a 4-digit PIN (for callers whose number isn't registered)
5. Click the **+** button

When a registered phone number calls, the AI greets them by name and has their project context ready. Unrecognized callers are prompted to enter a PIN.

### Configure the Twilio webhook

Twilio needs to know where to send incoming calls. In the [Twilio Console](https://console.twilio.com):

1. Go to **Phone Numbers** → **Manage** → **Active numbers**
2. Click your phone number
3. Under **Voice Configuration**, set:
   - **A call comes in**: Webhook
   - **URL**: `https://your-domain.com/api/voice/incoming`
   - **HTTP Method**: POST

For local development, use [ngrok](https://ngrok.com) to expose your backend:

```bash
ngrok http 8000
```

Then use the ngrok HTTPS URL as your webhook (e.g., `https://abc123.ngrok.io/api/voice/incoming`).

### Test a call

Call your Twilio phone number. If your number is registered as a caller mapping, you'll be greeted by name and can ask about your project. If not, you'll be prompted for a PIN.

---

## 5. Embed in Microsoft Teams

ChatGantt runs as a Teams tab application. The frontend loads in an iframe, and a reverse proxy or bot framework injects the connection headers.

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
| Ticketing provider token | Reverse proxy / `Authorization` header | Proxy config (not in app) | Read/write tickets from Jira, Linear, etc. |
| Chat LLM API key | Chat settings UI (gear icon in chat panel) | Browser localStorage | AI chat assistant (Claude or GPT) |
| Twilio Account SID | Voice settings UI (phone icon in header) | Server memory (in-process) | Phone call connectivity |
| Twilio Auth Token | Voice settings UI | Server memory (in-process) | Phone call authentication |
| OpenAI Realtime API key | Voice settings UI | Server memory (in-process) | Voice-to-voice AI conversation |

**Data residency:** No API keys or secrets are ever written to disk by ChatGantt. Chat keys live in the browser. Voice/Twilio keys live in server memory and are lost on restart. Ticketing provider credentials live in your proxy configuration, which you control.

---

## Troubleshooting

**App loads but shows no tasks**
- Check that `X-Provider` and `X-Project` headers are being sent. Without them, the app uses the mock provider with demo data.
- Verify your provider adapter is registered and `test_connection()` passes.

**Chat assistant doesn't respond**
- Open chat settings and verify your API key is entered.
- Check the browser console for errors (401 = invalid key, 502 = provider error).

**Voice calls don't connect**
- Verify voice credentials are configured (phone icon → check for green "Configured" status).
- Ensure the Twilio webhook URL points to your server's `/api/voice/incoming` endpoint.
- For local development, make sure ngrok is running and the Twilio webhook uses the ngrok URL.

**Caller not recognized**
- Verify the phone number is registered in caller mappings (E.164 format with country code).
- If using PIN, ensure it was set when creating the mapping.

**Permission denied (403) on edits**
- Check that `X-User-Role` is set to `editor` (or not set at all — the default is editor).

**Tasks not updating after drag**
- Check the browser console for API errors. The app optimistically updates the UI and rolls back on failure.
- Verify your provider token has write permissions.
