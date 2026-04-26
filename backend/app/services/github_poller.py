"""Background poller that fetches GitHub PRs and matches them to tickets."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.adapters.base import TicketProviderAdapter
from app.models.tickets import ConnectionConfig, TicketUpdate
from app.services.github_config import GitHubConfig, GitHubMatchRule, get_config, get_github_token

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"

_last_poll_at: Optional[str] = None


def get_last_poll_at() -> Optional[str]:
    return _last_poll_at


async def fetch_prs(
    client: httpx.AsyncClient, repo: str, token: str
) -> List[Dict[str, Any]]:
    """Fetch recent PRs from a GitHub repo with review status."""
    owner, name = repo.split("/", 1)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    resp = await client.get(
        f"{GITHUB_API}/repos/{owner}/{name}/pulls",
        params={"state": "all", "sort": "updated", "per_page": 50},
        headers=headers,
    )
    resp.raise_for_status()
    raw_prs = resp.json()

    results = []
    for pr in raw_prs:
        state = "merged" if pr.get("merged_at") else pr.get("state", "open")

        # Fetch review status
        review_status = "pending"
        try:
            reviews_resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{name}/pulls/{pr['number']}/reviews",
                headers=headers,
            )
            if reviews_resp.status_code == 200:
                reviews = reviews_resp.json()
                states = [r.get("state", "").upper() for r in reviews]
                if "APPROVED" in states:
                    review_status = "approved"
                elif "CHANGES_REQUESTED" in states:
                    review_status = "changes_requested"
                elif states:
                    review_status = "review_required"
        except Exception:
            pass

        results.append({
            "number": pr["number"],
            "title": pr.get("title", ""),
            "state": state,
            "html_url": pr.get("html_url", ""),
            "author": pr.get("user", {}).get("login", ""),
            "branch": pr.get("head", {}).get("ref", ""),
            "body": pr.get("body", "") or "",
            "review_status": review_status,
            "updated_at": pr.get("updated_at", ""),
        })

    return results


def match_prs_to_tickets(
    prs: List[Dict[str, Any]],
    ticket_ids: List[str],
    match_rules: List[GitHubMatchRule],
) -> Dict[str, List[Dict[str, Any]]]:
    """Match PRs to ticket IDs based on config rules."""
    matches: Dict[str, List[Dict[str, Any]]] = {}

    for ticket_id in ticket_ids:
        matched = []
        for pr in prs:
            for rule in match_rules:
                pattern = rule.pattern.replace("{ticket_id}", re.escape(ticket_id))
                regex = re.compile(pattern, re.IGNORECASE)
                for field in rule.search_in:
                    value = pr.get(field, "")
                    if regex.search(value):
                        matched.append(pr)
                        break
                else:
                    continue
                break

        if matched:
            # Deduplicate by html_url
            seen = set()
            unique = []
            for pr in matched:
                if pr["html_url"] not in seen:
                    seen.add(pr["html_url"])
                    unique.append(pr)
            matches[ticket_id] = unique

    return matches


async def run_poll_cycle(
    adapter: TicketProviderAdapter, connection_config: ConnectionConfig
) -> int:
    """Run one poll cycle. Returns the number of ticket-PR matches found."""
    global _last_poll_at

    config = get_config()
    token = get_github_token()
    if not config or not token:
        return 0

    # Fetch all tickets
    tree = await adapter.get_project_tree(connection_config)
    ticket_ids = [t.id for t in tree.tickets]
    ticket_meta = {t.id: (t.provider_meta or {}) for t in tree.tickets}

    total_matches = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        all_prs: List[Dict[str, Any]] = []
        for repo in config.repos:
            try:
                repo_prs = await fetch_prs(client, repo, token)
                all_prs.extend(repo_prs)
                logger.info("Fetched %d PRs from %s", len(repo_prs), repo)
            except Exception as e:
                logger.warning("Failed to fetch PRs from %s: %s", repo, e)

        matches = match_prs_to_tickets(all_prs, ticket_ids, config.match_rules)

        for ticket_id, matched_prs in matches.items():
            existing_meta = ticket_meta.get(ticket_id, {})
            existing_prs = existing_meta.get("github_prs", [])

            # Preserve manually-added PRs
            manual_prs = [p for p in existing_prs if p.get("source") == "manual"]
            manual_urls = {p.get("html_url") for p in manual_prs}

            # Build new list: auto-discovered (excluding manual URLs) + manual
            auto_prs = [
                {
                    "number": pr["number"],
                    "title": pr["title"],
                    "state": pr["state"],
                    "html_url": pr["html_url"],
                    "author": pr["author"],
                    "review_status": pr["review_status"],
                    "source": "auto",
                    "updated_at": pr["updated_at"],
                }
                for pr in matched_prs
                if pr["html_url"] not in manual_urls
            ]

            merged = auto_prs + manual_prs

            try:
                await adapter.update_ticket(
                    connection_config,
                    ticket_id,
                    TicketUpdate(provider_meta={"github_prs": merged}),
                )
                total_matches += len(merged)
            except Exception as e:
                logger.warning("Failed to update %s with PRs: %s", ticket_id, e)

    _last_poll_at = datetime.now(timezone.utc).isoformat()
    logger.info("Poll cycle complete: %d ticket-PR associations", total_matches)
    return total_matches
