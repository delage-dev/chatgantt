# ChatGantt Features

A Gantt chart application with an integrated AI assistant, voice calling, and rich communication tools for product/design/engineering workflows. Built with FastAPI and React. Designed as a stateless pass-through to ticket providers — no sensitive data stored on disk.

---

## Gantt Chart

### Timeline & Navigation
- Day-based timeline grid (48px per day) with day/month column headers
- Infinite scroll detection: timeline automatically extends by 14 days when scrolling within 5 days of either edge
- Auto-scrolls to today on initial load
- Synchronized scrolling between the sticky left tree pane (450px) and the scrollable right timeline
- Prominent red "today" marker line
- Horizontal scroll auto-locked while reordering tree items

### Task Hierarchy & Tree View
- Four-level hierarchy: Epic > Story > Task > Subtask
- Expandable/collapsible tree nodes with expand-all toggle
- Depth-based indentation (24px per level)
- Type badges displayed per row (EPIC, STORY, task arrow icon)
- Assignee avatars and status text in the tree pane
- Compact indicators on each row: priority context icon, acceptance criteria progress badge, risk indicators

### Task Bar Rendering
- Bars styled by ticket type:
  - **Epic**: Tallest bars with bold borders, shadows, and full color fill
  - **Story**: Medium bars with moderate styling
  - **Task/Subtask**: Compact bars with lighter styling
- Color inheritance: tasks inherit their root epic's color scheme (5 deterministic palettes: rose, teal, apricot, periwinkle, umber)
- Dot-texture overlay on frontend/UI-tagged tasks
- In-progress tasks show a 50% dark overlay to indicate partial completion
- Hover tooltip displaying ticket ID, type, summary, risk level, assignee, dates, status, criteria progress, and priority rationale excerpt

### Drag & Drop — Date Editing
- **Move**: Drag the center of a task bar to shift start and end dates together
- **Resize left edge**: Adjust the start date
- **Resize right edge**: Adjust the end date
- All movements snap to the day grid
- Cascading parent dates: when a child task extends beyond its parent's bounds, the parent automatically expands. Parent QA buffers shift along with the parent's end date.
- Pointer capture for smooth tracking across the viewport

### Drag & Drop — Tree Reordering
- Grip handle on each tree row enables drag-to-reorder within the same parent (powered by `@dnd-kit/sortable`)
- Smart drop targeting: when a sibling is expanded, dragging over its children resolves to the sibling itself (no need to collapse first)
- Cross-parent drops are rejected
- Order is persisted via a `sort_order` field, batched to the backend
- Children automatically move with their parent and retain internal order

### QA Spans
- Separate striped bars (diagonal stripe pattern) representing QA estimation periods
- Independently draggable and resizable (right edge)
- Positioned below the main task bar within the same row
- Add QA buffer from the detail drawer (defaults to 1 day after task end, 2-day duration)
- Remove QA with confirmation

### Dependencies
- SVG-based curved arrow lines connecting dependent tasks
- Conflict detection: flags when an upstream task's end date overlaps a downstream task's start date
- Conflict visualization: red dashed lines with clickable "!" markers
- Dismissible conflict indicators
- Cycle detection prevents circular dependencies when adding new links

### Risk Indicators
- **Overdue** (red "!"): task not marked Done and end date has passed
- **At-risk** (gold "!"): task still in "To Do" with 0-3 days until deadline
- Indicators appear on both tree rows and timeline bars (colored borders)

### Filtering
- Project filter dropdown in the header (filters by project name stored in epic metadata)
- Tree expand/collapse controls which rows are visible on the timeline

---

## Task Detail Drawer

A 450px slide-in panel (right side, spring-animated) with four tabs: **Details**, **Design**, **Resources**, **Comments**.

### Details Tab
- Ticket ID and type badges
- Large title display
- Inline markdown editor for descriptions (click to edit, Ctrl+Enter to save, Esc to cancel, GitHub Flavored Markdown)
- **Priority Context** section: rationale (markdown), stakeholder goals (chips), linked objectives (chips)
- Metadata grid: status, type, timeline, assignee (with avatar), domain tags
- Domain tags color-coded by category (frontend, backend, API, generic)
- **Pull Requests** section: linked GitHub PRs with state/review badges (see GitHub Integration below)
- Dependency management: list current dependencies, searchable picker to add new ones, remove button per dependency
- QA section: view/add/remove QA date ranges
- **Acceptance Criteria** section: checkable list with progress header (e.g., "3/5"), add/remove/toggle criteria

### Design Tab
- Live Figma frame embeds via iframe (`figma.com/embed?embed_host=chatgantt&url=...`)
- Miro and generic design link cards with source badges
- "Add Design Link" form with auto-detection of design tool type from URL
- Remove button per linked design

### Resources Tab
- Fetch and display resources linked to a specific ticket

### Comments Tab
- Loads ticket comments on demand
- Displays comment author avatar, display name, timestamp, and content
- **Markdown rendering** for comment content (bold, links, code blocks, etc.)
- **Comment creation**: textarea + send button at the bottom; optimistically appends, rolls back on failure
- Enter to send (Shift+Enter for newline)

---

## Permissions

### Roles
- **Editor** (default): full access — drag, reorder, edit, add/remove dependencies and QA buffers, modify all fields
- **Viewer**: read-only browsing plus the ability to comment

### Configuration
- Role assigned via the optional `X-User-Role` HTTP header (`viewer` or `editor`)
- Identity headers: `X-User-Id`, `X-User-Name` for comment authorship
- All headers optional — when absent, the app behaves as if no permissions exist (defaults to editor)
- Invalid role values default to editor (graceful degradation)

### Enforcement
- Backend: `PATCH /api/tasks/{id}` and `POST /api/tasks/batch` return 403 for viewers
- Frontend: drag handles, edit buttons, add/remove controls all hidden when read-only
- `GET /api/me` endpoint returns the resolved user context
- `usePermissions` hook caches the result and falls back to editor on fetch failure

---

## AI Chat Assistant

### Chat Panel
- Floating toggle button (bottom-right corner)
- 400x550px chat window with message history
- User messages right-aligned (dark background), assistant messages left-aligned (light background)
- Markdown rendering for assistant responses
- Input: textarea with Enter to send, Shift+Enter for newline
- Loading spinner while awaiting response

### LLM Providers
- **Anthropic Claude** (claude-sonnet-4)
- **OpenAI GPT** (gpt-4o)
- Provider and API key configured via settings modal
- API keys stored in browser localStorage only, sent per-request, never persisted server-side

### Context Awareness
- Every message includes the full project task hierarchy (IDs, summaries, types, statuses, assignees, dates)
- Per-task enrichment in the system prompt:
  - **Design links** (Figma, Miro, generic)
  - **Acceptance criteria** (counts and incomplete items)
  - **Priority context** (rationale, stakeholder goals)
  - **GitHub PRs** (number, title, state, review status)
- Fetched project resources included up to 16KB total
- Multi-turn conversation history maintained during session

---

## Voice Calling

Inbound phone calls for status updates and project briefings using Twilio + OpenAI Realtime.

### How It Works
1. User dials a configured Twilio phone number
2. Twilio webhook hits `/api/voice/incoming` → backend returns TwiML with `<Connect><Stream>`
3. Backend bridges audio bidirectionally between Twilio (G.711 mulaw) and OpenAI Realtime (also G.711 mulaw — zero transcoding)
4. AI converses naturally with the caller, fully aware of the project state

### Configuration
- Voice settings modal opened via the phone icon in the header
- Required credentials (entered via UI, held in server memory only — never disk):
  - Twilio Account SID
  - Twilio Auth Token
  - Twilio phone number (the number users dial)
  - OpenAI API key with Realtime API access
- Process restart clears credentials (zero-storage philosophy)

### Caller Identification
- **Caller ID mapping**: Phone number → user name → project key. Registered callers get personalized greetings.
- **DTMF PIN fallback**: Unknown callers prompted for a 4-digit PIN
- Both managed via the Voice Settings UI

### Voice Conversation Features
- Natural voice (default: `alloy`)
- Server-side voice activity detection (VAD) for turn-taking
- Barge-in support: when caller starts speaking, in-progress AI audio is canceled
- AI system prompt includes project hierarchy, criteria, priority context, and PR status — same enrichment as chat

---

## GitHub PR Integration

Auto-discovered and manually-linked GitHub pull requests visible on each ticket.

### Configuration File
- `chatgantt.config.json` at the project root (user-managed, version-controllable)
- Specifies repos to poll and matching rules (e.g., `{ticket_id}` pattern in PR title/branch/body)
- GitHub token referenced by env var name (e.g., `GITHUB_TOKEN`) — never stored in the file
- No file or no token → feature silently disabled

### Auto-Discovery
- Background poller runs every 5 minutes
- Fetches recent PRs from configured repos via the GitHub REST API
- Matches PRs to tickets by searching configured fields (title, branch, body) for ticket IDs
- Enriches with review status (approved, changes requested, pending)
- Manually-linked PRs preserved across poll cycles

### Manual Linking
- Paste a GitHub PR URL into the **Pull Requests** section in the details tab
- Detects `owner/repo/pull/number` from the URL
- Next poll cycle enriches with title, status, author, review state if the repo is in the config

### Display
- Compact PR cards: number link, state badge (OPEN/MERGED/CLOSED), title, author, review badge (APPROVED/CHANGES REQ/PENDING), source label (auto/manual), remove button
- AI assistant aware of all linked PRs

### Admin Endpoints
- `GET /api/github/status` — enabled state, repos, last poll time
- `POST /api/github/reload-config` — re-read config without restart
- `POST /api/github/poll` — trigger immediate poll cycle

---

## Project Knowledge / Resources

### Resources Panel
- Floating toggle button (bottom-left corner)
- 380x500px panel for managing external knowledge sources
- Add URLs via input field (Enter key or plus button)
- "Fetch All" button for concurrent resource retrieval
- Remove individual URLs with trash button
- URL list persisted in localStorage

### Resource Processing
- Fetches any URL with automatic HTML-to-text extraction (scripts and styles removed)
- Title extraction from HTML `<title>` tag or URL path
- Content truncated to 4,000 characters per resource with indicator
- Resource cards display: title, source URL, summary (first 200 chars), expandable content preview, last-fetched timestamp

### Integration
- Fetched resources are included in the AI chat system prompt for context-aware responses
- Resources can be associated with individual tickets (viewed in the detail drawer's resources tab)

---

## Data & Synchronization

### Optimistic Updates
- UI updates immediately on drag/resize/edit actions
- Debounced API calls (1-second delay) batch rapid changes
- Automatic rollback to original values on API failure

### Polling
- Background polling every 30 seconds for external changes
- Merge strategy preserves pending local (optimistic) changes while incorporating server updates
- Silent failure on poll errors (no disruptive UI)

### Batch Operations
- Batch update endpoint for modifying multiple tickets in a single request (used for tree reordering)
- Returns succeeded and failed ticket IDs

### Deep-Merge for Extensible Metadata
- `provider_meta` is the schema-free home for design links, acceptance criteria, priority context, GitHub PRs, and tags
- Backend deep-merges `provider_meta` updates so changing one key doesn't clobber others
- Frontend store mirrors the same merge logic for optimistic updates

---

## Security & Input Sanitization

### Sanitization Middleware
Raw ASGI middleware that runs on every HTTP request:
- **Body size limit**: 10 MB (rejected with 413 if exceeded)
- **Per-string size limit**: 100 KB per string field (rejected with 400 and field path)
- **Null byte rejection**: Any string containing `\x00` rejected with a precise field path (e.g., `provider_meta.design_links[0].url`)
- **Control character stripping**: C0 control chars (`\x01-\x1F`, `\x7F`) silently stripped from JSON strings
- **Whitespace preservation**: `\t`, `\n`, `\r` always preserved (essential for markdown and code blocks)
- **Header validation**: Custom `X-*` headers checked for control characters
- **Markdown-safe**: Doesn't strip HTML/script tags — handled safely by ReactMarkdown's default escaping
- **Path exemptions**: Voice webhook endpoints (`/api/voice/incoming`, `/api/voice/pin-verify`, `/api/voice/stream`) bypass JSON sanitization since they receive form-encoded webhooks or WebSocket binary

### Zero-Storage Philosophy
- No API keys, tokens, or user data ever written to disk by the application
- LLM keys live in browser localStorage
- Voice/Twilio/OpenAI Realtime keys live in server memory (lost on restart)
- Ticketing provider tokens live in proxy/env config (user-controlled)
- GitHub token referenced by env var name in config file

---

## Ticket Provider Architecture

### Stateless Pass-Through Design
- No session management or server-side state
- Provider connection configured via HTTP headers per request: `X-Provider`, `X-Project`, `X-Base-Url`, `Authorization`
- User identity headers (optional): `X-User-Id`, `X-User-Name`, `X-User-Role`
- Designed for embedding in chat platforms (Microsoft Teams, etc.)

### Adapter System
- Pluggable provider adapters implementing a shared protocol
- Required operations: fetch project tree, fetch/update individual tickets, batch updates, fetch comments, create comments, test connection
- Registry pattern with runtime adapter registration

### Currently Implemented
- **Mock adapter**: in-memory demo with 2 epics, 15+ tasks, realistic hierarchy, dependencies, QA estimates, comments, domain tags, markdown descriptions, sample design links, acceptance criteria, and priority context

### Error Handling
- Typed errors: AuthenticationError (401), TicketNotFoundError (404), RateLimitError (429 with Retry-After)
- Proper HTTP status code mapping in API routes

---

## UI & Design

### Visual Style
- Brutalist warm earthtone palette (backgrounds: #EDE5D4, #F5EFE2; foreground: #2C2824; accents: muted browns)
- Five per-epic color schemes assigned deterministically by epic ID hash
- Dot textures on frontend-tagged task bars
- Striped patterns on QA spans

### Animations & Interactions
- Spring-based animations via Motion (drawer slide-in, hover effects)
- Hover lift on task bars (-translate-y-0.5)
- Pulsing loading states
- Toast notifications via Sonner

### Keyboard Shortcuts
- **Ctrl+Enter**: Save description edits
- **Escape**: Cancel editing
- **Enter**: Send chat message or comment (Shift+Enter for newline)

### Header
- Logo badge, application title, project selector dropdown
- Phone icon button → Voice Settings modal
- Sync dropdown showing integration connection status and last sync timestamps

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Pydantic, httpx, uvicorn |
| Frontend | React 19, TypeScript 5.9, Vite 8 |
| Styling | Tailwind CSS 4, custom CSS variables |
| State | Zustand |
| UI Primitives | Radix UI (Dialog, Dropdown, Tooltip) |
| Drag & Drop | @dnd-kit (core, sortable, modifiers) |
| Animations | Motion |
| Dates | date-fns |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |
| Notifications | Sonner |
| LLM SDKs | anthropic, openai |
| Voice | twilio (TwiML), websockets (OpenAI Realtime bridge) |

---

## API Endpoints Summary

### Tasks
- `GET /api/tasks` — full project tree
- `GET /api/tasks/{id}` — single ticket
- `PATCH /api/tasks/{id}` — update ticket (editor-only)
- `POST /api/tasks/batch` — batch update (editor-only)
- `GET /api/tasks/{id}/comments` — fetch comments
- `POST /api/tasks/{id}/comments` — create comment

### User
- `GET /api/me` — current user context (role + identity)

### Chat & Resources
- `POST /api/chat` — send message to AI assistant with project context
- `POST /api/resources/fetch` — fetch external URLs as project knowledge

### Voice
- `POST /api/voice/config` — save Twilio + OpenAI credentials (in-memory)
- `GET /api/voice/config` — config status (masked)
- `POST /api/voice/callers` — register caller mapping
- `GET /api/voice/callers` — list mappings
- `DELETE /api/voice/callers/{phone}` — remove mapping
- `POST /api/voice/incoming` — Twilio webhook (returns TwiML)
- `POST /api/voice/pin-verify` — DTMF PIN verification webhook
- `WS /api/voice/stream` — Twilio ↔ OpenAI Realtime audio bridge

### GitHub
- `GET /api/github/status` — integration status
- `POST /api/github/reload-config` — re-read config file
- `POST /api/github/poll` — trigger immediate PR poll

### Health
- `GET /api/health` — health check
