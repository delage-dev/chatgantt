from scripts.provision_notion import (
    build_blockers_schema,
    build_self_relation_props,
    build_tasks_schema,
)


def test_tasks_schema_core_props():
    s = build_tasks_schema()
    assert s["Name"] == {"title": {}}
    assert {o["name"] for o in s["Type"]["select"]["options"]} == {"Epic", "Story", "Task"}
    assert "date" in s["Timeline"]
    assert s["Assignee"] == {"people": {}}
    assert s["Description"] == {"rich_text": {}}
    # Status is a select, not status-type (Notion API cannot create status props)
    assert "select" in s["Status"]


def test_blockers_schema_relations_target_tasks():
    s = build_blockers_schema("TASKS_DS")
    assert s["Blocked task"]["relation"]["data_source_id"] == "TASKS_DS"
    assert s["Blocking task"]["relation"]["data_source_id"] == "TASKS_DS"
    assert {o["name"] for o in s["Severity"]["select"]["options"]} == {"low", "medium", "high"}
    assert {o["name"] for o in s["Status"]["select"]["options"]} == {"active", "resolved"}
    assert s["Auto resolved"] == {"checkbox": {}}


def test_self_relation_props_dual_to_self():
    props = build_self_relation_props("SELF_DS")
    assert props["Parent item"]["relation"]["data_source_id"] == "SELF_DS"
    assert "dual_property" in props["Parent item"]["relation"]
    assert props["Blocked by"]["relation"]["data_source_id"] == "SELF_DS"
    assert "dual_property" in props["Blocked by"]["relation"]
