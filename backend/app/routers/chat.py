from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.chat.registry import get_chat_adapter
from app.adapters.registry import get_adapter
from app.dependencies import get_connection_config, get_user_context
from app.models.chat import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatRole,
    ToolCallExecution,
    ToolResult,
)
from app.models.tickets import ConnectionConfig, UserContext
from app.services.chat_context import build_system_prompt
from app.services.chat_tools import execute_tool_call, get_blocker_tools

router = APIRouter()

MAX_TOOL_ITERATIONS = 5


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    try:
        chat_adapter = get_chat_adapter(request.provider.value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Adapter for tool execution (against the same provider as the project)
    try:
        ticket_adapter = get_adapter(config.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    system_prompt = build_system_prompt(request.project_context)
    tools = get_blocker_tools()

    messages: list[ChatMessage] = list(request.messages)
    executions: list[ToolCallExecution] = []
    final_text = ""

    try:
        for _ in range(MAX_TOOL_ITERATIONS):
            result = await chat_adapter.chat(
                messages=messages,
                system_prompt=system_prompt,
                api_key=request.api_key,
                tools=tools,
            )

            final_text = result.text or final_text

            if result.stop_reason == "tool_use" and result.tool_calls:
                # Append assistant turn with tool_calls
                messages.append(ChatMessage(
                    role=ChatRole.ASSISTANT,
                    content=result.text or "",
                    tool_calls=result.tool_calls,
                ))

                # Execute each tool call
                tool_results: list[ToolResult] = []
                for tc in result.tool_calls:
                    execution = await execute_tool_call(
                        ticket_adapter, config, user.user_id, tc
                    )
                    executions.append(execution)
                    tool_results.append(ToolResult(
                        tool_call_id=tc.id,
                        content=execution.result,
                        is_error=not execution.succeeded,
                    ))

                # Append user turn with tool results
                messages.append(ChatMessage(
                    role=ChatRole.USER,
                    content="",
                    tool_results=tool_results,
                ))
                continue

            # Terminal stop reason
            break
        else:
            # Hit iteration cap
            final_text = (final_text or "") + "\n\n(Tool iteration limit reached.)"

    except Exception as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "api key" in error_msg.lower():
            raise HTTPException(status_code=401, detail="Invalid API key")
        raise HTTPException(status_code=502, detail=f"LLM provider error: {error_msg}")

    return ChatResponse(
        message=ChatMessage(role=ChatRole.ASSISTANT, content=final_text or ""),
        tool_executions=executions,
    )
