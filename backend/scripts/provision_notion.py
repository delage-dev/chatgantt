"""Provision the ChatGantt Tasks + Blockers Notion data sources.

Usage:
    uv run python -m scripts.provision_notion --token <secret> --parent-page <page_id> --dry-run
    uv run python -m scripts.provision_notion --token <secret> --parent-page <page_id> --apply

The property names/types here are the contract consumed by
``app/adapters/notion/mappers.py`` — keep them in sync.

NOTE: ``--apply`` hits the live Notion API and creates databases. The exact
create-database response shape and the two-phase self-relation flow
(2025-09-03) should be verified against a throwaway workspace before relying on
it — see backend/scripts/README.md. ``--dry-run`` prints the schema JSON only.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from typing import Any

import httpx

from app.adapters.notion.client import NOTION_VERSION

TASKS_TITLE = "ChatGantt Tasks"
BLOCKERS_TITLE = "ChatGantt Blockers"


# ─── pure schema builders (unit-tested) ─────────────────────────────────────


def _select(*options: str) -> dict:
    return {"select": {"options": [{"name": o} for o in options]}}


def build_tasks_schema() -> dict[str, Any]:
    """Initial Tasks properties. Self-relations are added in a 2nd pass once
    the data-source ID is known (see build_self_relation_props)."""
    return {
        "Name": {"title": {}},
        "Type": _select("Epic", "Story", "Task"),
        "Status": _select("Not started", "In progress", "Done"),
        "Timeline": {"date": {}},
        "Due": {"date": {}},
        "Assignee": {"people": {}},
        "Description": {"rich_text": {}},
        "Priority": _select("High", "Medium", "Low"),
    }


def build_self_relation_props(tasks_ds_id: str) -> dict[str, Any]:
    """Dual self-relations added to the Tasks data source after creation.
    'Parent item' auto-creates the synced 'Sub-items' side; 'Blocked by'
    auto-creates the synced 'Blocking' side."""
    return {
        "Parent item": {
            "relation": {"data_source_id": tasks_ds_id, "dual_property": {}}
        },
        "Blocked by": {
            "relation": {"data_source_id": tasks_ds_id, "dual_property": {}}
        },
    }


def build_blockers_schema(tasks_ds_id: str) -> dict[str, Any]:
    return {
        "Name": {"title": {}},
        "Blocked task": {"relation": {"data_source_id": tasks_ds_id, "single_property": {}}},
        "Blocking task": {"relation": {"data_source_id": tasks_ds_id, "single_property": {}}},
        "External blocker": {"rich_text": {}},
        "Reason": {"rich_text": {}},
        "Severity": _select("low", "medium", "high"),
        "Status": _select("active", "resolved"),
        "Created by": {"rich_text": {}},
        "Created at": {"date": {}},
        "Resolved at": {"date": {}},
        "Resolved by": {"rich_text": {}},
        "Auto resolved": {"checkbox": {}},
    }


# ─── live apply (verify against a throwaway workspace before trusting) ───────


async def _create_database(http: httpx.AsyncClient, token: str, parent_page: str,
                           title: str, properties: dict) -> dict:
    resp = await http.post(
        "/v1/databases",
        headers={"Authorization": f"Bearer {token}", "Notion-Version": NOTION_VERSION},
        json={
            "parent": {"type": "page_id", "page_id": parent_page},
            "title": [{"text": {"content": title}}],
            "initial_data_source": {"properties": properties},
        },
    )
    resp.raise_for_status()
    return resp.json()


async def _patch_data_source(http: httpx.AsyncClient, token: str, ds_id: str,
                             properties: dict) -> dict:
    resp = await http.patch(
        f"/v1/data_sources/{ds_id}",
        headers={"Authorization": f"Bearer {token}", "Notion-Version": NOTION_VERSION},
        json={"properties": properties},
    )
    resp.raise_for_status()
    return resp.json()


def _extract_data_source_id(db: dict) -> str:
    # Shape varies; try the documented spots. Verify live.
    ids = db.get("initial_data_source", {}).get("id") or db.get("data_sources", [{}])[0].get("id")
    if not ids:
        raise RuntimeError(f"Could not find data source id in create response: {json.dumps(db)[:300]}")
    return ids


async def apply(token: str, parent_page: str) -> dict[str, str]:
    async with httpx.AsyncClient(base_url="https://api.notion.com", timeout=30.0) as http:
        tasks_db = await _create_database(http, token, parent_page, TASKS_TITLE, build_tasks_schema())
        tasks_ds = _extract_data_source_id(tasks_db)
        await _patch_data_source(http, token, tasks_ds, build_self_relation_props(tasks_ds))
        blockers_db = await _create_database(
            http, token, parent_page, BLOCKERS_TITLE, build_blockers_schema(tasks_ds)
        )
        blockers_ds = _extract_data_source_id(blockers_db)
        return {"tasks_data_source": tasks_ds, "blockers_data_source": blockers_ds}


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision ChatGantt Notion data sources")
    parser.add_argument("--token", required=True, help="Notion internal integration token")
    parser.add_argument("--parent-page", required=True, help="Parent page ID to create DBs under")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Print schema JSON only")
    group.add_argument("--apply", action="store_true", help="Create the databases (live)")
    args = parser.parse_args()

    if args.dry_run:
        print(json.dumps({
            "tasks": build_tasks_schema(),
            "tasks_self_relations": build_self_relation_props("<TASKS_DS_ID>"),
            "blockers": build_blockers_schema("<TASKS_DS_ID>"),
        }, indent=2))
        return

    result = asyncio.run(apply(args.token, args.parent_page))
    print("Provisioned. Set these headers when calling ChatGantt with X-Provider: notion")
    print(f"  X-Project: {result['tasks_data_source']}")
    print(f"  X-Notion-Blockers-Source: {result['blockers_data_source']}")


if __name__ == "__main__":
    main()
