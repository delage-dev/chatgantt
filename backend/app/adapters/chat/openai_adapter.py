from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.models.chat import ChatMessage, ChatTurnResult, ToolCall, ToolDefinition


def _format_messages_for_openai(messages: List[ChatMessage]) -> List[Dict[str, Any]]:
    """Convert our ChatMessage list to OpenAI's chat.completions format."""
    out: List[Dict[str, Any]] = []
    for m in messages:
        if m.tool_calls:
            out.append({
                "role": m.role.value,
                "content": m.content or None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments),
                        },
                    }
                    for tc in m.tool_calls
                ],
            })
        elif m.tool_results:
            for tr in m.tool_results:
                out.append({
                    "role": "tool",
                    "tool_call_id": tr.tool_call_id,
                    "content": tr.content,
                })
        else:
            out.append({"role": m.role.value, "content": m.content})
    return out


class OpenAIChatAdapter:
    MODEL = "gpt-4o"

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: str,
        api_key: str,
        tools: Optional[List[ToolDefinition]] = None,
    ) -> ChatTurnResult:
        import openai

        client = openai.AsyncOpenAI(api_key=api_key)

        kwargs: Dict[str, Any] = {
            "model": self.MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                *_format_messages_for_openai(messages),
            ],
        }
        if tools:
            kwargs["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    },
                }
                for t in tools
            ]

        response = await client.chat.completions.create(**kwargs)
        msg = response.choices[0].message

        tool_calls: List[ToolCall] = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                except json.JSONDecodeError:
                    args = {}
                tool_calls.append(ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=args,
                ))

        finish = response.choices[0].finish_reason
        stop_reason = "tool_use" if finish == "tool_calls" else "end_turn"

        return ChatTurnResult(
            text=msg.content,
            tool_calls=tool_calls,
            stop_reason=stop_reason,
        )
