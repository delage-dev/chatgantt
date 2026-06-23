from app.dependencies import get_connection_config


async def test_blockers_source_header_populates_extra():
    cfg = await get_connection_config(
        x_provider="notion",
        x_project="ds1",
        x_base_url="https://api.notion.com",
        authorization="Bearer tok",
        x_notion_blockers_source="bds1",
    )
    assert cfg.provider == "notion"
    assert cfg.project_key == "ds1"
    assert cfg.access_token == "tok"
    assert cfg.extra["blockers_source"] == "bds1"


async def test_absent_blockers_source_gives_empty_extra():
    cfg = await get_connection_config(
        x_provider="mock",
        x_project="DEMO",
        x_base_url="",
        authorization="",
        x_notion_blockers_source="",
    )
    assert cfg.extra == {}
