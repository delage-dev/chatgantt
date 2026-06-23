from app.dependencies import get_connection_config


async def test_notion_config_from_env(monkeypatch):
    monkeypatch.setenv("NOTION_TOKEN", "secret_tok")
    monkeypatch.setenv("NOTION_TASKS_DATA_SOURCE", "ds_tasks")
    monkeypatch.setenv("NOTION_BLOCKERS_DATA_SOURCE", "ds_blockers")

    cfg = await get_connection_config()

    assert cfg.provider == "notion"
    assert cfg.access_token == "secret_tok"
    assert cfg.base_url == ""
    assert cfg.project_key == "ds_tasks"
    assert cfg.extra["blockers_source"] == "ds_blockers"


async def test_notion_config_without_blockers_source(monkeypatch):
    monkeypatch.setenv("NOTION_TOKEN", "secret_tok")
    monkeypatch.setenv("NOTION_TASKS_DATA_SOURCE", "ds_tasks")
    monkeypatch.delenv("NOTION_BLOCKERS_DATA_SOURCE", raising=False)

    cfg = await get_connection_config()

    assert cfg.provider == "notion"
    assert cfg.extra == {}


async def test_mock_fallback_when_notion_token_unset(monkeypatch):
    monkeypatch.delenv("NOTION_TOKEN", raising=False)

    cfg = await get_connection_config()

    assert cfg.provider == "mock"
    assert cfg.project_key == "DEMO"
    assert cfg.access_token == ""
    assert cfg.extra == {}
