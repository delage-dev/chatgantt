from app import settings


def test_notion_token_reads_env(monkeypatch):
    monkeypatch.setenv("NOTION_TOKEN", "secret_abc")
    assert settings.notion_token() == "secret_abc"


def test_notion_token_none_when_unset(monkeypatch):
    monkeypatch.delenv("NOTION_TOKEN", raising=False)
    assert settings.notion_token() is None


def test_notion_tasks_data_source_reads_env(monkeypatch):
    monkeypatch.setenv("NOTION_TASKS_DATA_SOURCE", "ds_tasks")
    assert settings.notion_tasks_data_source() == "ds_tasks"


def test_notion_tasks_data_source_none_when_unset(monkeypatch):
    monkeypatch.delenv("NOTION_TASKS_DATA_SOURCE", raising=False)
    assert settings.notion_tasks_data_source() is None


def test_notion_blockers_data_source_reads_env(monkeypatch):
    monkeypatch.setenv("NOTION_BLOCKERS_DATA_SOURCE", "ds_blockers")
    assert settings.notion_blockers_data_source() == "ds_blockers"


def test_notion_blockers_data_source_none_when_unset(monkeypatch):
    monkeypatch.delenv("NOTION_BLOCKERS_DATA_SOURCE", raising=False)
    assert settings.notion_blockers_data_source() is None


def test_chat_provider_defaults_to_anthropic(monkeypatch):
    monkeypatch.delenv("CHAT_PROVIDER", raising=False)
    assert settings.chat_provider() == "anthropic"


def test_chat_provider_reads_env(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "openai")
    assert settings.chat_provider() == "openai"


def test_chat_api_key_reads_env(monkeypatch):
    monkeypatch.setenv("CHAT_API_KEY", "sk-test")
    assert settings.chat_api_key() == "sk-test"


def test_chat_api_key_none_when_unset(monkeypatch):
    monkeypatch.delenv("CHAT_API_KEY", raising=False)
    assert settings.chat_api_key() is None
