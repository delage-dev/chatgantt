from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.models.chat import ChatMessage, ChatTurnResult, ToolCall, ToolDefinition


def _format_messages_for_anthropic(messages: List[ChatMessage]) -> List[Dict[str, Any]]:
    """Convert our ChatMessage list to Anthropic's content-blocks format."""
    out: List[Dict[str, Any]] = []
    for m in messages:
        if m.tool_calls:
            # Assistant turn with tool_use blocks
            content_blocks: List[Dict[str, Any]] = []
            if m.content:
                content_blocks.append({"type": "text", "text": m.content})
            for tc in m.tool_calls:
                content_blocks.append({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tc.name,
                    "input": tc.arguments,
                })
            out.append({"role": m.role.value, "content": content_blocks})
        elif m.tool_results:
            # User turn carrying tool_result blocks
            content_blocks = []
            for tr in m.tool_results:
                content_blocks.append({
                    "type": "tool_result",
                    "tool_use_id": tr.tool_call_id,
                    "content": tr.content,
                    **({"is_error": True} if tr.is_error else {}),
                })
            out.append({"role": "user", "content": content_blocks})
        else:
            out.append({"role": m.role.value, "content": m.content})
    return out


class AnthropicChatAdapter:
    MODEL = "claude-sonnet-4-20250514"

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: str,
        api_key: str,
        tools: Optional[List[ToolDefinition]] = None,
    ) -> ChatTurnResult:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=api_key)

        kwargs: Dict[str, Any] = {
            "model": self.MODEL,
            "max_tokens": 2048,
            "system": system_prompt,
            "messages": _format_messages_for_anthropic(messages),
        }
        if tools:
            kwargs["tools"] = [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                }
                for t in tools
            ]

        response = await client.messages.create(**kwargs)

        text_parts: List[str] = []
        tool_calls: List[ToolCall] = []
        for block in response.content:
            block_type = getattr(block, "type", None)
            if block_type == "text":
                text_parts.append(getattr(block, "text", ""))
            elif block_type == "tool_use":
                tool_calls.append(ToolCall(
                    id=getattr(block, "id", ""),
                    name=getattr(block, "name", ""),
                    arguments=getattr(block, "input", {}) or {},
                ))

        text = "\n".join(p for p in text_parts if p) if text_parts else None
        stop_reason = response.stop_reason or "end_turn"

        return ChatTurnResult(text=text, tool_calls=tool_calls, stop_reason=stop_reason)
