"""Speech-to-text for Alice, through Groq's Whisper API.

A browser's own voice typing depends on a speech service run by the
browser's vendor. That service can stop working without warning (as
Chrome's did), and some browsers have none at all. Recording the audio in
the page and transcribing it here removes that dependency entirely: the
same microphone works in every browser, on one free key.

Failures raise 503 with a message the guest can act on; the frontend then
invites them to type instead.
"""
import logging

import requests
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("ihg.stt")

GROQ_TRANSCRIBE_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"
REQUEST_TIMEOUT_SECONDS = 30
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def transcribe(audio_bytes: bytes, filename: str = "speech.webm") -> str:
    """Returns the spoken text, or raises HTTPException. An empty result is
    not an error: it means the recording held no speech."""
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice input isn't available right now — please type your message instead.",
        )
    if not audio_bytes:
        return ""
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="That recording is too long — please keep it under a minute.",
        )

    try:
        response = requests.post(
            GROQ_TRANSCRIBE_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            files={"file": (filename, audio_bytes, "application/octet-stream")},
            data={
                "model": settings.groq_stt_model,
                "response_format": "json",
                "language": "en",
                # Steers Whisper toward the words this conversation actually
                # uses, so room types and hotel terms come back spelled right.
                "prompt": "A hotel guest talking to a concierge about rooms, suites, balconies, "
                          "views, check-in and check-out dates, guests, restaurant tables and food delivery.",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.warning("Groq transcription unreachable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="I couldn't reach the speech service — please type your message instead.",
        )

    if response.status_code == 200:
        try:
            return (response.json().get("text") or "").strip()
        except ValueError:
            return ""

    detail = response.text[:300]
    logger.warning("Groq transcription failed (%s): %s", response.status_code, detail)
    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice input isn't configured correctly — please type your message instead.",
        )
    if response.status_code == 429:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice input is busy at the moment — please type your message instead.",
        )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="I couldn't make out that recording — please try again, or type your message.",
    )