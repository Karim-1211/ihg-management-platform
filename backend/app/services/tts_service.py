"""Voice narration for Alice, through a chain of providers.

The order comes from TTS_PROVIDER_ORDER (default: kokoro, elevenlabs,
gemini, groq) and the first provider that answers is used:

  kokoro      — local, open-weight, unlimited. Only present on a developer
                machine: it needs far more memory than a free server has, so
                it is imported lazily and simply skipped where not installed.
  elevenlabs  — the best hosted quality, within a monthly credit allowance.
  gemini      — Gemini's speech models, using the same keys as Alice's chat.
  groq        — optional; enabled by setting GROQ_TTS_MODEL.

A provider that runs out of quota or rejects its key is rested for
COOLDOWN_SECONDS, so an exhausted ElevenLabs account doesn't add a failed
round-trip to every request for the rest of the month.

When every provider fails, a 503 tells the frontend to use the browser's
built-in voice. Every provider returns 16-bit mono WAV, so the frontend
never needs to know which one answered.
"""
import base64
import io
import logging
import re
import time
import wave

import requests
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("ihg.tts")

MAX_CHARS = 1500
REQUEST_TIMEOUT_SECONDS = 30
COOLDOWN_SECONDS = 30 * 60

# Signals that mean "out of quota, or key refused" rather than a passing
# network problem. Only these put a provider on cooldown.
_QUOTA_SIGNALS = (
    "quota", "429", "resource_exhausted", "rate limit", "rate_limit",
    "401", "402", "insufficient", "credits", "unauthorized",
    # A refused project or key won't fix itself between requests either.
    "403", "permission_denied", "denied access",
)

_cooldown_until: dict[str, float] = {}
_kokoro_pipeline = None


class ProviderSkipped(Exception):
    """Not installed or not configured — move on quietly."""


class ProviderFailed(Exception):
    """Tried and failed. When `rest` is true the provider is put on cooldown."""

    def __init__(self, message: str, rest: bool = False):
        super().__init__(message)
        self.rest = rest


def _looks_like_quota(message: str) -> bool:
    lowered = message.lower()
    return any(signal in lowered for signal in _QUOTA_SIGNALS)


def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    """Wraps raw 16-bit mono PCM in a WAV header, using only the standard
    library — so hosted providers need neither numpy nor soundfile."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buffer.getvalue()


# ---------- Providers ----------

def _kokoro(text: str) -> bytes:
    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError as exc:
        raise ProviderSkipped(f"not installed ({exc.name or exc})") from exc

    global _kokoro_pipeline
    if _kokoro_pipeline is None:
        # Loaded once and reused: reloading per request would reload the
        # full model weights on every call.
        _kokoro_pipeline = KPipeline(lang_code="a")

    chunks = [audio for _, _, audio in _kokoro_pipeline(text, voice=settings.kokoro_voice)]
    if not chunks:
        raise ProviderFailed("produced no audio")
    full_audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]

    buffer = io.BytesIO()
    sf.write(buffer, full_audio, 24000, format="WAV")
    return buffer.getvalue()


def _elevenlabs(text: str) -> bytes:
    if not settings.elevenlabs_api_key:
        raise ProviderSkipped("ELEVENLABS_API_KEY not set")

    try:
        response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}",
            params={"output_format": "pcm_24000"},
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={"text": text, "model_id": settings.elevenlabs_model_id},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise ProviderFailed(f"could not reach ElevenLabs: {exc}") from exc

    if response.status_code == 200 and response.content:
        return _pcm_to_wav(response.content, 24000)

    detail = response.text[:300]
    rest = response.status_code in (401, 402, 429) or _looks_like_quota(detail)
    raise ProviderFailed(f"HTTP {response.status_code}: {detail}", rest=rest)


def _gemini(text: str) -> bytes:
    keys = [key for key in (settings.gemini_api_key_1, settings.gemini_api_key_2) if key]
    if not keys:
        raise ProviderSkipped("no GEMINI_API_KEY set")
    if not settings.gemini_tts_model_list:
        raise ProviderSkipped("GEMINI_TTS_MODELS is empty")

    from google import genai
    from google.genai import types

    errors = []
    for model in settings.gemini_tts_model_list:
        for index, key in enumerate(keys, start=1):
            try:
                client = genai.Client(api_key=key)
                response = client.models.generate_content(
                    model=model,
                    contents=text,
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=settings.gemini_tts_voice,
                                )
                            )
                        ),
                    ),
                )
                inline = response.candidates[0].content.parts[0].inline_data
                data = inline.data
                if isinstance(data, str):
                    data = base64.b64decode(data)
                if not data:
                    raise ValueError("empty audio")
                # Gemini returns raw PCM and names the sample rate in the
                # MIME type, e.g. "audio/L16;codec=pcm;rate=24000".
                match = re.search(r"rate=(\d+)", inline.mime_type or "")
                return _pcm_to_wav(data, int(match.group(1)) if match else 24000)
            except Exception as exc:
                errors.append(f"{model} / key {index}: {exc}")

    summary = "; ".join(errors)[:500]
    raise ProviderFailed(summary, rest=_looks_like_quota(summary))


def _groq(text: str) -> bytes:
    if not settings.groq_api_key or not settings.groq_tts_model:
        raise ProviderSkipped("GROQ_TTS_MODEL not set")

    payload = {"model": settings.groq_tts_model, "input": text, "response_format": "wav"}
    if settings.groq_tts_voice:
        payload["voice"] = settings.groq_tts_voice

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/audio/speech",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise ProviderFailed(f"could not reach Groq: {exc}") from exc

    if response.status_code == 200 and response.content:
        return response.content

    detail = response.text[:300]
    rest = response.status_code in (401, 402, 429) or _looks_like_quota(detail)
    raise ProviderFailed(f"HTTP {response.status_code}: {detail}", rest=rest)


PROVIDERS = {
    "kokoro": _kokoro,
    "elevenlabs": _elevenlabs,
    "gemini": _gemini,
    "groq": _groq,
}


# ---------- Public API ----------

def synthesize_speech_with_provider(text: str) -> tuple[bytes, str]:
    """Returns (wav_bytes, provider_name) from the first provider that
    answers. Raises 503 when none do — the frontend's cue to use the
    browser's own voice."""
    if not text or not text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No text to narrate.")

    text = text.strip()[:MAX_CHARS]
    outcomes = []

    for name in settings.tts_providers:
        provider = PROVIDERS.get(name)
        if provider is None:
            logger.warning("Unknown voice provider %r in TTS_PROVIDER_ORDER — skipped.", name)
            continue

        if _cooldown_until.get(name, 0) > time.monotonic():
            outcomes.append(f"{name}: resting after a quota error")
            continue

        try:
            return provider(text), name
        except ProviderSkipped as exc:
            outcomes.append(f"{name}: {exc}")
        except ProviderFailed as exc:
            outcomes.append(f"{name}: {exc}")
            if exc.rest:
                _cooldown_until[name] = time.monotonic() + COOLDOWN_SECONDS
                logger.warning("Voice provider %s resting for %d minutes: %s", name, COOLDOWN_SECONDS // 60, exc)
            else:
                logger.warning("Voice provider %s failed: %s", name, exc)
        except Exception as exc:  # a provider bug must never take the request down
            outcomes.append(f"{name}: unexpected {type(exc).__name__}")
            logger.exception("Voice provider %s raised unexpectedly", name)

    logger.info("No voice provider answered: %s", " | ".join(outcomes))
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Voice narration is unavailable right now — the browser voice will be used instead.",
    )


def synthesize_speech(text: str, voice: str | None = None) -> bytes:
    """The original signature, kept so any existing caller still works.
    `voice` is ignored: each provider's voice is now a setting."""
    audio, _provider = synthesize_speech_with_provider(text)
    return audio