from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.models.api import TutorRequest
from app.services.tutor import (
    build_messages,
    circuit_digest,
    classify,
    offline_answer,
    tutor_meta,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tutor", tags=["tutor"])

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _stream_offline(text: str, reason: str | None = None) -> AsyncIterator[str]:
    words = text.split(" ")
    buffer: list[str] = []
    for index, word in enumerate(words):
        buffer.append(word)
        if len(buffer) >= 4 or index == len(words) - 1:
            yield _event({"type": "delta", "text": " ".join(buffer) + " "})
            buffer = []
            await asyncio.sleep(0.02)
    yield _event({"type": "done", "source": "offline", "reason": reason})


async def _stream_openai(request: TutorRequest) -> AsyncIterator[str]:
    settings = get_settings()
    messages = build_messages(
        request.prompt,
        request.circuit,
        request.lesson_id,
        [turn.model_dump() for turn in request.history],
        request.challenge_slug,
    )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
        stream = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=settings.openai_temperature,
            max_tokens=settings.openai_max_tokens,
            stream=True,
        )
    except Exception as error:
        logger.warning(
            "tutor model call failed, falling back to the read-out "
            "(model=%s, base_url=%s): %s",
            settings.openai_model,
            settings.openai_base_url or "default (OpenAI)",
            error,
        )
        async for chunk in _stream_offline(
            offline_answer(
                request.prompt, request.circuit, request.lesson_id, request.challenge_slug
            ),
            reason=f"model unavailable: {error}",
        ):
            yield chunk
        return

    produced = False
    try:
        async for event in stream:
            if not event.choices:
                continue
            delta = event.choices[0].delta
            text = getattr(delta, "content", None)
            if text:
                produced = True
                yield _event({"type": "delta", "text": text})
    except asyncio.CancelledError:
        raise
    except Exception as error:
        if not produced:
            async for chunk in _stream_offline(
                offline_answer(
                request.prompt, request.circuit, request.lesson_id, request.challenge_slug
            ),
                reason=f"stream broke: {error}",
            ):
                yield chunk
            return
        yield _event({"type": "error", "message": str(error)})

    yield _event({"type": "done", "source": "openai", "model": settings.openai_model})


@router.post("/ask")
async def ask(request: TutorRequest) -> StreamingResponse:
    settings = get_settings()

    async def generator() -> AsyncIterator[str]:
        yield _event(
            {
                "type": "meta",
                "live": settings.tutor_live,
                "model": settings.openai_model if settings.tutor_live else "local read-out",
                "looking": tutor_meta(request.circuit, request.lesson_id),
            }
        )
        if settings.tutor_live:
            async for chunk in _stream_openai(request):
                yield chunk
        else:
            async for chunk in _stream_offline(
                offline_answer(
                request.prompt, request.circuit, request.lesson_id, request.challenge_slug
            ),
                reason="OPENAI_API_KEY is not set on the server",
            ):
                yield chunk

    return StreamingResponse(
        generator(), media_type="text/event-stream", headers=SSE_HEADERS
    )


@router.post("/explain")
async def explain(request: TutorRequest) -> dict[str, Any]:
    return {
        "reading": classify(request.circuit) if request.circuit else None,
        "digest": circuit_digest(request.circuit),
        "answer": offline_answer(
                request.prompt, request.circuit, request.lesson_id, request.challenge_slug
            ),
        "live": get_settings().tutor_live,
        "looking": tutor_meta(request.circuit, request.lesson_id),
    }


@router.get("/status")
async def status() -> dict[str, Any]:
    settings = get_settings()
    return {
        "live": settings.tutor_live,
        "model": settings.openai_model if settings.tutor_live else None,
        # What is configured, reported whether or not it is usable. `model` above
        # keeps its old shape for the site, which reads it to label the panel;
        # these two exist so a misconfiguration can be diagnosed over HTTP
        # instead of by reading the server log.
        "configured_model": settings.openai_model,
        "configured_base_url": settings.openai_base_url or "default (OpenAI)",
        "has_key": bool(settings.openai_api_key),
        "fallback": "deterministic circuit read-out computed with Qiskit",
    }
