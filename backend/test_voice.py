"""Tries every voice provider once and reports which ones work.

Run from backend/:
    python test_voice.py

Each working voice is saved to your Desktop as alice_voice_<name>.wav, so
you can hear the difference. The test uses about 70 characters of
ElevenLabs credit.
"""
import time
from pathlib import Path

from app.core.config import settings
from app.services import tts_service

SAMPLE = "Good evening, and welcome to IHG Grand Dhaka. I'm Alice. How can I help?"


def main():
    out_dir = Path.home() / "Desktop"
    if not out_dir.exists():
        out_dir = Path.cwd()

    print("\n  ALICE VOICE CHECK")
    print("  " + "=" * 70)
    print(f"  Order: {' -> '.join(settings.tts_providers)} -> browser voice\n")

    working = []
    for name in settings.tts_providers:
        provider = tts_service.PROVIDERS.get(name)
        if provider is None:
            print(f"  ????  {name:<11} unknown provider name")
            continue

        started = time.monotonic()
        try:
            audio = provider(SAMPLE)
        except tts_service.ProviderSkipped as exc:
            print(f"  SKIP  {name:<11} {exc}")
            continue
        except tts_service.ProviderFailed as exc:
            print(f"  FAIL  {name:<11} {str(exc)[:220]}")
            continue
        except Exception as exc:
            print(f"  FAIL  {name:<11} {type(exc).__name__}: {str(exc)[:220]}")
            continue

        seconds = time.monotonic() - started
        path = out_dir / f"alice_voice_{name}.wav"
        path.write_bytes(audio)
        working.append(name)
        print(f"  OK    {name:<11} {len(audio) // 1024} KB in {seconds:.1f}s  ->  {path}")

    print()
    if working:
        print(f"  Guests will hear: {working[0]}")
        if len(working) > 1:
            print(f"  Fallbacks ready:  {', '.join(working[1:])}")
    else:
        print("  No hosted voice answered — guests will hear the browser's voice.")
    print()


if __name__ == "__main__":
    main()