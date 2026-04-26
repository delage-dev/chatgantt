"""Load and cache GitHub integration config from chatgantt.config.json.

The config file lives at the project root and is version-controllable.
The GitHub token is referenced by env var name — never stored in the file.
If the file is missing or the token env var isn't set, GitHub features
are silently disabled.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class GitHubMatchRule(BaseModel):
    pattern: str
    search_in: List[str]


class GitHubConfig(BaseModel):
    token_env: str
    repos: List[str]
    match_rules: List[GitHubMatchRule]


class AppConfig(BaseModel):
    github: Optional[GitHubConfig] = None


_config: Optional[AppConfig] = None
_config_path: Optional[Path] = None


def _default_config_path() -> Path:
    env_path = os.environ.get("CHATGANTT_CONFIG")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent.parent.parent.parent / "chatgantt.config.json"


def load_config(path: Optional[Path] = None) -> Optional[GitHubConfig]:
    global _config, _config_path
    _config_path = path or _default_config_path()

    if not _config_path.is_file():
        logger.info("No config file at %s — GitHub integration disabled", _config_path)
        _config = None
        return None

    try:
        raw = json.loads(_config_path.read_text())
        _config = AppConfig(**raw)
    except Exception as e:
        logger.warning("Failed to parse config file %s: %s", _config_path, e)
        _config = None
        return None

    if not _config.github:
        logger.info("No 'github' section in config — GitHub integration disabled")
        return None

    token = get_github_token()
    if not token:
        logger.warning(
            "Env var '%s' not set — GitHub integration disabled",
            _config.github.token_env,
        )
        return None

    logger.info(
        "GitHub integration enabled: %d repos, %d match rules",
        len(_config.github.repos),
        len(_config.github.match_rules),
    )
    return _config.github


def get_config() -> Optional[GitHubConfig]:
    if _config is None:
        return None
    return _config.github


def get_github_token() -> Optional[str]:
    cfg = _config.github if _config else None
    if not cfg:
        return None
    return os.environ.get(cfg.token_env) or None
