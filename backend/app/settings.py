"""Typed accessors for single-tenant server-side config.

All credentials and provider config are read from the process environment
(populated from ``backend/.env`` via ``load_dotenv`` in ``app.main``). The
frontend supplies nothing — this module is the single source of truth.
"""

from __future__ import annotations

import os
from typing import Optional


def notion_token() -> Optional[str]:
    """Notion integration token, or ``None`` if unset (dev → mock)."""
    return os.getenv("NOTION_TOKEN") or None


def notion_tasks_data_source() -> Optional[str]:
    """Tasks data-source ID (= ``ConnectionConfig.project_key``)."""
    return os.getenv("NOTION_TASKS_DATA_SOURCE") or None


def notion_blockers_data_source() -> Optional[str]:
    """Blockers data-source ID (= ``extra['blockers_source']``)."""
    return os.getenv("NOTION_BLOCKERS_DATA_SOURCE") or None


def chat_provider() -> str:
    """Chat LLM provider for the assistant. Defaults to ``anthropic``."""
    return os.getenv("CHAT_PROVIDER") or "anthropic"


def chat_api_key() -> Optional[str]:
    """Server-side LLM key for the chat assistant, or ``None`` if unset."""
    return os.getenv("CHAT_API_KEY") or None
