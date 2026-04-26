# Permissions in ChatGantt

ChatGantt has a simple, non-breaking permission system with two roles: **editor** and **viewer**. Permissions are designed to degrade gracefully — if no role is configured, everyone gets full access.

---

## Roles

| Role | View tasks | Comment | Edit tasks |
|------|-----------|---------|------------|
| **Editor** | Yes | Yes | Yes |
| **Viewer** | Yes | Yes | No |

**Editor** is the default. If no permissions are configured, every user is an editor with full access.

---

## How Roles Are Assigned

Roles are assigned via an HTTP header: `X-User-Role`. This header is set by whatever sits in front of ChatGantt — typically a reverse proxy, bot framework, or Teams integration layer.

| Header | Value | Result |
|--------|-------|--------|
| `X-User-Role: editor` | `editor` | Full access |
| `X-User-Role: viewer` | `viewer` | Read-only (can still comment) |
| *(header not set)* | — | Defaults to **editor** |
| *(invalid value)* | e.g., `admin` | Defaults to **editor** |

ChatGantt does not have a built-in user management UI for assigning roles. Roles are injected per-request from outside the app. This is by design — ChatGantt stores no user data and acts as a stateless pass-through.

### Checking your current role

Open the app and visit `/api/me` in your browser, or run:

```
GET /api/me
```

Response:

```json
{
  "user_id": "alice",
  "display_name": "Alice Chen",
  "role": "editor"
}
```

---

## What Viewers Can Do

Viewers have full read access to the project. They can:

- View the Gantt chart with all task bars, timelines, and dependency lines
- Expand and collapse the task hierarchy in the left panel
- Click any task to open the detail drawer
- Read descriptions, statuses, assignees, dependencies, and QA dates
- See risk indicators (overdue, at-risk)
- Filter by project
- **Post comments** on any task
- Use the AI chat assistant
- Use voice calling for status updates

---

## What Viewers Cannot Do

Viewers cannot modify task data. The following actions are blocked both in the UI and on the backend:

| Action | UI behavior | Backend behavior |
|--------|-------------|------------------|
| Drag a task bar to change dates | Cursor shows as default, drag is disabled | Returns 403 |
| Resize a task's start or end date | Resize handles non-interactive | Returns 403 |
| Reorder tasks in the left panel | Drag handle hidden, sorting disabled | Returns 403 |
| Edit a task description | Edit button hidden, text is read-only | Returns 403 |
| Add or remove a dependency | Add/remove buttons hidden | Returns 403 |
| Add or remove a QA buffer | Add/remove buttons hidden | Returns 403 |

If a viewer bypasses the UI (e.g., via a direct API call), the backend returns `403 Forbidden` with the message "Viewer role cannot modify tasks."

---

## What the UI Looks Like for Each Role

### Editor view

- Task bars on the timeline show a grab cursor and can be dragged or resized
- Each row in the left panel has a grip handle for reordering
- The detail drawer shows edit buttons for descriptions, dependencies, and QA buffers
- The description area shows "Add a description..." placeholder if empty

### Viewer view

- Task bars are static — no grab cursor, no resize handles
- No grip handles in the left panel — rows cannot be reordered
- The detail drawer shows data in read-only form with no edit or remove buttons
- Empty descriptions show "No description" text instead of an edit prompt
- The comment form at the bottom of the Comments tab is still active

---

## Configuring Permissions

Because ChatGantt doesn't store user data, role assignment happens outside the app. How you configure it depends on your deployment.

### In a Teams deployment

The reverse proxy or bot framework that sits between Teams and ChatGantt injects the `X-User-Role` header based on the user's Teams identity. For example:

```nginx
# nginx example — set role based on a lookup
proxy_set_header X-User-Role $user_role;
```

You can map Teams roles to ChatGantt roles however you like. A common setup:

| Teams role | ChatGantt role |
|-----------|---------------|
| Channel owner | `editor` |
| Channel member | `editor` |
| Guest | `viewer` |

### With a custom proxy or middleware

Set the header before requests reach ChatGantt:

```
X-User-Role: viewer
```

This can be hardcoded per user, looked up from a directory service, or derived from the ticketing provider's own permissions.

### For local development

Pass the header directly to test each role:

```bash
# Test as editor (default)
curl http://localhost:8000/api/me

# Test as viewer
curl -H "X-User-Role: viewer" http://localhost:8000/api/me

# Verify viewer is blocked from editing
curl -X PATCH \
  -H "X-User-Role: viewer" \
  -H "Content-Type: application/json" \
  -d '{"description": "test"}' \
  http://localhost:8000/api/tasks/DEMO-1
# Returns: {"detail": "Viewer role cannot modify tasks"}
```

---

## User Identity Headers

In addition to the role, ChatGantt accepts identity headers for display purposes and comment authorship:

| Header | Default | Purpose |
|--------|---------|---------|
| `X-User-Id` | `anonymous` | Identifies the user for comment authorship |
| `X-User-Name` | `Anonymous` | Display name shown on comments |
| `X-User-Role` | `editor` | Controls edit permissions |

All three are optional. When a user posts a comment, their `X-User-Id` is used to look up or create the comment author. If no identity headers are set, comments are attributed to "anonymous."

---

## Graceful Degradation

The permission system is designed to never break the app:

- **No headers?** Full editor access. The app works exactly as if permissions don't exist.
- **Invalid role value?** Treated as editor. Only the exact string `"viewer"` restricts access.
- **Backend unreachable when checking permissions?** The frontend defaults to editor mode. The backend is the real enforcement layer — if it comes back up, unauthorized edits will be rejected with 403 and rolled back in the UI.
- **Old backend without `/api/me`?** The frontend catches the error and defaults to editor. No crash, no broken UI.

This means you can adopt permissions incrementally. Start without any headers, then add `X-User-Role` when you're ready to restrict access — nothing breaks in between.
