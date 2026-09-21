"""Phase 30c — voice narration via Kokoro (local, open-weight, Apache-2.0
licensed — no API key, no account, no credits, no monthly limit). Replaces
the earlier ElevenLabs integration entirely. The pipeline loads the model
once at first use and is reused for every subsequent request — reloading
it per-request would reload the full model weights every single call."""

import io

import numpy as np
import soundfile as sf
from fastapi import HTTPException, status
from kokoro import KPipeline

DEFAULT_VOICE = "af_bella"

_pipeline = None


def _get_pipeline() -> KPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = KPipeline(lang_code="a")
    return _pipeline


def synthesize_speech(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    if not text or not text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No text to narrate.")

    try:
        pipeline = _get_pipeline()
        chunks = [audio for _, _, audio in pipeline(text[:1500], voice=voice)]
        if not chunks:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Voice narration produced no audio.")
        full_audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Voice narration failed: {e}")

    buffer = io.BytesIO()
    sf.write(buffer, full_audio, 24000, format="WAV")
    buffer.seek(0)
    return buffer.read()