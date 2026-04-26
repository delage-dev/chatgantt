from __future__ import annotations

from typing import Dict, List

from app.models.chat import BlockerSummary, TaskContext, TaskSummary


def build_system_prompt(project_context: TaskContext) -> str:
    lines = [
        "You are a helpful project assistant for ChatGantt, a Gantt chart application.",
        f"You have access to the task data for project '{project_context.project_key}'.",
        "Use this context to answer questions about the project's tasks, timeline, "
        "assignments, status, and help with planning.",
        "",
        "## Project Tasks",
        "",
    ]

    # Build parent -> children map
    children_map: Dict[str, List[TaskSummary]] = {}
    root_tasks: List[TaskSummary] = []
    for t in project_context.tasks:
        if t.parent_id:
            children_map.setdefault(t.parent_id, []).append(t)
        else:
            root_tasks.append(t)

    # Build task_id -> active blockers map (where this task is the blocked side)
    blockers_by_blocked: Dict[str, List[BlockerSummary]] = {}
    if project_context.blockers:
        for b in project_context.blockers:
            if b.status == "active":
                blockers_by_blocked.setdefault(b.blocked_task_id, []).append(b)

    def format_task(task: TaskSummary, indent: int = 0) -> None:
        prefix = "  " * indent + "- "
        assignee = f" (@{task.assignee})" if task.assignee else ""
        dates = ""
        if task.start_date and task.end_date:
            dates = f" [{task.start_date} to {task.end_date}]"
        lines.append(
            f"{prefix}**{task.id}** {task.summary} "
            f"({task.type}, {task.status}){assignee}{dates}"
        )

        # Enrich with provider_meta details
        meta = task.provider_meta or {}
        detail_prefix = "  " * (indent + 1) + "  "

        design_links = meta.get("design_links", [])
        if design_links:
            link_strs = [f'{dl.get("type", "link").capitalize()} "{dl.get("title", "")}"' for dl in design_links]
            lines.append(f"{detail_prefix}Design: {', '.join(link_strs)}")

        criteria = meta.get("acceptance_criteria", [])
        if criteria:
            done = sum(1 for c in criteria if c.get("completed"))
            total = len(criteria)
            incomplete = [c.get("text", "") for c in criteria if not c.get("completed")]
            incomplete_str = "; ".join(incomplete[:5])
            lines.append(f"{detail_prefix}Criteria: {done}/{total} — {incomplete_str}")

        priority = meta.get("priority_context", {})
        if priority.get("rationale"):
            lines.append(f"{detail_prefix}Priority: {priority['rationale'][:200]}")
        goals = priority.get("stakeholder_goals", [])
        if goals:
            lines.append(f"{detail_prefix}Goals: {', '.join(goals)}")

        prs = meta.get("github_prs", [])
        if prs:
            pr_strs = [
                f'#{pr.get("number")} "{pr.get("title", "")}" ({pr.get("state", "")}, review: {pr.get("review_status", "")})'
                for pr in prs
            ]
            lines.append(f"{detail_prefix}PRs: {'; '.join(pr_strs)}")

        # Active blockers on this task
        task_blockers = blockers_by_blocked.get(task.id, [])
        for b in task_blockers:
            target = b.blocking_task_id or b.external_blocker or "unknown"
            lines.append(
                f"{detail_prefix}Blocked by: {target} — {b.reason[:120]} ({b.severity}, blocker_id={b.id})"
            )

        for child in children_map.get(task.id, []):
            format_task(child, indent + 1)

    for root in root_tasks:
        format_task(root)

    # Project-wide active blockers section
    active_blockers = [b for b in (project_context.blockers or []) if b.status == "active"]
    if active_blockers:
        lines.append("")
        lines.append("## Active Blockers")
        lines.append("")
        for b in active_blockers:
            target = b.blocking_task_id or f'external: "{b.external_blocker}"'
            lines.append(
                f"- **{b.id}** — {b.blocked_task_id} blocked by {target} ({b.severity}): {b.reason[:200]}"
            )

    # Add project knowledge/resources if available
    if project_context.resources:
        lines.append("")
        lines.append("## Project Knowledge")
        lines.append("")

        MAX_TOTAL_RESOURCE_CHARS = 16000
        chars_remaining = MAX_TOTAL_RESOURCE_CHARS

        for res in project_context.resources:
            if chars_remaining <= 0:
                lines.append("(Additional resources omitted due to context limits)")
                break
            content = res.content[:chars_remaining]
            chars_remaining -= len(content)
            lines.append(f"### [{res.title}]({res.source_url})")
            lines.append(content)
            lines.append("")

    lines.append("")
    lines.append("When answering, be concise and reference task IDs when relevant.")

    return "\n".join(lines)
