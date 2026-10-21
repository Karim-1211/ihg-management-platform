"""Speech-to-text for Alice, through Groq's Whisper API.

A browser's own voice typing depends on a speech service run by the
browser's vendor, which can stop working without warning. Recording the
audio in the page and transcribing it here removes that dependency.

Whisper invents sentences when it is given silence or room noise. Two
defences, both server-side:

  1. Whisper's own confidence. verbose_json reports, for every segment, the
     probability that it contains no speech, its average log-probability and
     its compression ratio. A segment that fails these is dropped.
  2. A short list of filler phrases Whisper is known to produce.

Every segment's numbers are logged, so the thresholds below can be judged
from real recordings rather than guessed.

No `prompt` is sent: Whisper tends to echo a prompt back when it hears nothing.
"""
import logging
import re

import requests
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("ihg.stt")

GROQ_TRANSCRIBE_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"
REQUEST_TIMEOUT_SECONDS = 30
MAX_AUDIO_BYTES = 10 * 1024 * 1024

# Whisper's own measures of whether a segment was really speech. Real speech
# normally has a very low no_speech_prob. These follow Whisper's standard
# thresholds, slightly stricter. Each decision is logged.
NO_SPEECH_CERTAIN = 0.6        # this likely to be silence: drop on its own
NO_SPEECH_LIKELY = 0.3         # drop if the model is also unsure of its words
LOGPROB_DOUBTFUL = -0.8
LOGPROB_HOPELESS = -1.5        # the model has little idea what it heard
COMPRESSION_REPETITIVE = 2.4   # the same phrase repeated: a hallucination loop

_HALLUCINATIONS = {
    "you", "thank you", "thanks", "thank you very much", "thanks for watching",
    "thank you for watching", "bye", "bye bye", "goodbye", "okay", "ok",
    "subtitles by the amara.org community", "amara.org", "please subscribe",
    "like and subscribe", "music", "applause", "silence", "beep", "uh", "um", "mm",
    "oh", "ah", "hmm", "huh", "er", "eh", "hello", "hi", "so lets go", "so let's go", "hotel guest", "a hotel guest",
}


def _is_noise(text: str) -> bool:
    """True when the transcript is almost certainly invented."""
    cleaned = re.sub(r"[^\w\s']", "", text).strip().lower()
    if not cleaned or len(cleaned) < 2:
        return True
    if cleaned in _HALLUCINATIONS:
        return True
    if "hotel guest" in cleaned and len(cleaned.split()) <= 8:
        return True
    words = cleaned.split()
    if len(words) >= 6 and len(set(words)) <= 3:
        return True
    return False


def _segment_is_speech(segment: dict) -> bool:
    """Whisper's confidence in one segment. A missing measure is ignored."""
    no_speech = segment.get("no_speech_prob")
    logprob = segment.get("avg_logprob")
    ratio = segment.get("compression_ratio")

    if no_speech is not None and no_speech >= NO_SPEECH_CERTAIN:
        return False
    if no_speech is not None and logprob is not None \
            and no_speech >= NO_SPEECH_LIKELY and logprob < LOGPROB_DOUBTFUL:
        return False
    if logprob is not None and logprob < LOGPROB_HOPELESS:
        return False
    if ratio is not None and ratio > COMPRESSION_REPETITIVE:
        return False
    return True


def _describe(segment: dict, kept: bool) -> str:
    def num(key: str) -> str:
        value = segment.get(key)
        return "n/a" if value is None else f"{value:.2f}"

    return (
        f"{'kept   ' if kept else 'dropped'} no_speech={num('no_speech_prob')} "
        f"logprob={num('avg_logprob')} ratio={num('compression_ratio')} "
        f"text={str(segment.get('text', '')).strip()!r}"
    )


def transcribe(audio_bytes: bytes, filename: str = "speech.webm") -> str:
    """Returns the spoken text, or an empty string when the recording held no
    real speech. An empty result is not an error: the caller says nothing
    rather than answering something nobody said."""
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
                "response_format": "verbose_json",
                "language": "en",
                "temperature": "0",
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
            payload = response.json()
        except ValueError:
            return ""

        segments = payload.get("segments")
        if isinstance(segments, list) and segments:
            kept_parts = []
            for segment in segments:
                keep = _segment_is_speech(segment)
                logger.info("STT segment %s", _describe(segment, keep))
                if keep:
                    kept_parts.append(str(segment.get("text", "")).strip())
            text = " ".join(part for part in kept_parts if part).strip()
        else:
            logger.info("STT: no confidence data in the response; using the text as it is.")
            text = (payload.get("text") or "").strip()

        if _is_noise(text):
            logger.info("STT discarded a filler phrase: %r", text)
            return ""
        return text

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