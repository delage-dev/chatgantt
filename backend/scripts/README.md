# Notion provisioning

Creates the two ChatGantt data sources in a Notion workspace.

## Prereqs
- A Notion **internal integration** token (`secret_…`), shared with the parent page.
- A parent **page ID** to create the databases under.

## Dry run (safe — prints schema JSON only)
```bash
uv run python -m scripts.provision_notion --token secret_xxx --parent-page <page_id> --dry-run
```

## Apply (live — creates `ChatGantt Tasks` + `ChatGantt Blockers`)
```bash
uv run python -m scripts.provision_notion --token secret_xxx --parent-page <page_id> --apply
```
Prints the header values to use:
```
X-Provider: notion
X-Project: <tasks_data_source_id>
X-Notion-Blockers-Source: <blockers_data_source_id>
Authorization: Bearer secret_xxx
```

## ⚠️ Verify `--apply` against a throwaway workspace first
The `--apply` path uses the `2025-09-03` data-source API. Two things to confirm live:
1. The `POST /v1/databases` response shape — `_extract_data_source_id` tries
   `initial_data_source.id` then `data_sources[0].id`; adjust if Notion differs.
2. The two-phase self-relation flow — Tasks is created first, then PATCHed to add
   the `Parent item` / `Blocked by` dual self-relations (a relation needs the target
   data-source ID, which only exists after creation).

`Status` is created as a **select** (Notion's API cannot create `status`-type
properties); the adapter mapper reads `Status` from either type.
