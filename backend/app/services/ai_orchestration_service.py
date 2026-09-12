"""Phase 20.2 — the single centralized AI Orchestration Service, per the
locked 20.1 architecture. Owns all provider API calls, the tool-execution
loop, and interaction logging. No other module calls a provider SDK
directly — if the provider chain ever changes, only this file changes.

Fallback chain (each step tried only on quota/rate-limit errors, not on
genuine tool/logic errors, which are raised immediately):
  Gemini key 1 -> Gemini key 2 -> Groq -> graceful "unavailable" message.
"""

import json

from google import genai
from google.genai import types as genai_types
from groq import Groq
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_log import AIInteractionLog
from app.models.user import User
from app.schemas.ai import AIChatMessage
from app.services import ai_constants
from app.services.ai_tool_registry import TOOL_DEFINITIONS, dispatch_tool


def _log_interaction(
    db: Session, current_user: User, prompt_summary: str, tools_called: list[str],
    token_usage: int | None, status: str, model_used: str, error_message: str | None = None,
) -> None:
    try:
        log = AIInteractionLog(
            user_id=current_user.id,
            role=current_user.role.value,
            assistant_type="CUSTOMER",
            prompt_summary=prompt_summary[:500],
            tools_called=",".join(tools_called) if tools_called else None,
            token_usage=token_usage,
            model_version=f"{model_used}:{ai_constants.CUSTOMER_ASSISTANT_PROMPT_VERSION}",
            status=status,
            error_message=error_message[:1000] if error_message else None,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()


def _is_quota_or_rate_error(e: Exception) -> bool:
    text = str(e).lower()
    return any(term in text for term in ["quota", "rate limit", "429", "resource_exhausted", "rate_limit_exceeded"])


# ---------- Gemini adapter ----------

def _gemini_tool_declarations() -> list[genai_types.Tool]:
    function_declarations = []
    for t in TOOL_DEFINITIONS:
        function_declarations.append(genai_types.FunctionDeclaration(
            name=t["name"], description=t["description"], parameters=t["input_schema"],
        ))
    return [genai_types.Tool(function_declarations=function_declarations)]


def _run_with_gemini(db: Session, current_user: User, api_key: str, model_name: str, messages: list[dict]) -> tuple[str, list[str], int]:
    client = genai.Client(api_key=api_key)
    tools = _gemini_tool_declarations()

    contents = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append(genai_types.Content(role=role, parts=[genai_types.Part(text=m["content"])]))

    tools_called: list[str] = []
    total_tokens = 0

    for _ in range(ai_constants.MAX_TOOL_ITERATIONS):
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=ai_constants.CUSTOMER_ASSISTANT_SYSTEM_PROMPT,
                tools=tools,
            ),
        )
        if response.usage_metadata:
            total_tokens += (response.usage_metadata.prompt_token_count or 0) + (response.usage_metadata.candidates_token_count or 0)

        candidate = response.candidates[0]
        function_calls = [p.function_call for p in candidate.content.parts if p.function_call]

        if not function_calls:
            text = "".join(p.text or "" for p in candidate.content.parts)
            return text or "I'm not sure how to help with that — could you rephrase?", tools_called, total_tokens

        contents.append(candidate.content)
        function_response_parts = []
        for fc in function_calls:
            tools_called.append(fc.name)
            result = dispatch_tool(db, current_user, fc.name, dict(fc.args) if fc.args else {})
            function_response_parts.append(genai_types.Part(
                function_response=genai_types.FunctionResponse(name=fc.name, response={"result": result})
            ))
        contents.append(genai_types.Content(role="user", parts=function_response_parts))

    return "I wasn't able to fully answer that — please try asking more specifically, or check My Account directly.", tools_called, total_tokens


# ---------- Groq adapter (OpenAI-compatible tool-calling format) ----------

def _groq_tool_definitions() -> list[dict]:
    return [
        {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
        for t in TOOL_DEFINITIONS
    ]


def _run_with_groq(db: Session, current_user: User, api_key: str, model_name: str, messages: list[dict]) -> tuple[str, list[str], int]:
    client = Groq(api_key=api_key)
    tools = _groq_tool_definitions()

    chat_messages = [{"role": "system", "content": ai_constants.CUSTOMER_ASSISTANT_SYSTEM_PROMPT}]
    chat_messages.extend(messages)

    tools_called: list[str] = []
    total_tokens = 0

    for _ in range(ai_constants.MAX_TOOL_ITERATIONS):
        response = client.chat.completions.create(
            model=model_name, messages=chat_messages, tools=tools, tool_choice="auto", max_tokens=1024,
        )
        if response.usage:
            total_tokens += response.usage.total_tokens or 0

        message = response.choices[0].message

        if not message.tool_calls:
            return message.content or "I'm not sure how to help with that — could you rephrase?", tools_called, total_tokens

        chat_messages.append({"role": "assistant", "content": message.content, "tool_calls": [tc.model_dump() for tc in message.tool_calls]})
        for tc in message.tool_calls:
            tools_called.append(tc.function.name)
            tool_input = json.loads(tc.function.arguments) if tc.function.arguments else {}
            result = dispatch_tool(db, current_user, tc.function.name, tool_input)
            chat_messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result, default=str)})

    return "I wasn't able to fully answer that — please try asking more specifically, or check My Account directly.", tools_called, total_tokens


# ---------- Public entry point ----------

def run_customer_assistant(
    db: Session, current_user: User, user_message: str, conversation_history: list[AIChatMessage]
) -> tuple[str, list[str]]:
    prompt_summary = user_message
    messages = [{"role": m.role, "content": m.content} for m in conversation_history]
    messages.append({"role": "user", "content": user_message})

    attempts = []
    if settings.gemini_api_key_1:
        attempts.append(("gemini-key-1", lambda: _run_with_gemini(db, current_user, settings.gemini_api_key_1, settings.ai_model_name_gemini, messages)))
    if settings.gemini_api_key_2:
        attempts.append(("gemini-key-2", lambda: _run_with_gemini(db, current_user, settings.gemini_api_key_2, settings.ai_model_name_gemini, messages)))
    if settings.groq_api_key:
        attempts.append(("groq", lambda: _run_with_groq(db, current_user, settings.groq_api_key, settings.ai_model_name_groq, messages)))

    if not attempts:
        _log_interaction(db, current_user, prompt_summary, [], None, "UNAVAILABLE", "none")
        return "The assistant isn't available right now. Please use the My Account page, or contact staff for help.", []

    last_error = None
    for label, attempt_fn in attempts:
        try:
            reply, tools_called, tokens = attempt_fn()
            _log_interaction(db, current_user, prompt_summary, tools_called, tokens, "SUCCESS", label)
            return reply, tools_called
        except Exception as e:
            last_error = e
            if _is_quota_or_rate_error(e):
                continue  # try the next provider in the chain
            _log_interaction(db, current_user, prompt_summary, [], None, "FAILED", label, str(e))
            return "The assistant is temporarily unavailable. Please try again shortly, or use My Account directly.", []

    _log_interaction(db, current_user, prompt_summary, [], None, "FAILED", "all-providers-exhausted", str(last_error))
    return "The assistant is very busy right now (all free capacity used). Please try again in a moment, or use My Account directly.", []