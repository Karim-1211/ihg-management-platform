"""Pre-generates Alice's fixed conversational lines as static WAV files in
the frontend's public folder, so they play instantly. Only dynamic content
(recommendations, order status, answers) still calls Kokoro live. Safe to
re-run.

Run from backend/:
    python generate_alice_prompts.py
"""
import os

import numpy as np
import soundfile as sf
from kokoro import KPipeline

VOICE = "af_bella"

PROMPTS = {
    # Hotel room finder
    "alice-greeting.wav": (
        "Hello, I'm Alice, your personal hotel concierge. I'm here to help you find the room you'll love. "
        "Tell me what you're looking for — a view, a balcony, a quiet floor, anything that matters to you."
    ),
    "alice-ask-checkin.wav": "Got it. What date would you like to check in?",
    "alice-ask-checkout.wav": "And what date would you like to check out?",
    "alice-ask-guests.wav": "And how many guests will be staying?",
    "alice-checking.wav": "Thank you. I'm checking the available rooms that match your preferences.",
    "alice-start-over.wav": "Sure — tell me what you're looking for this time.",
    "alice-retry-preference.wav": (
        "I'm sorry, I didn't quite catch that. Could you tell me a little more about what you're looking for in a room?"
    ),
    "alice-retry-checkin.wav": "I didn't quite catch that date. Could you tell me your check-in date again?",
    "alice-retry-checkout.wav": "I'm sorry, what date would you like to check out?",
    "alice-retry-guests.wav": "I didn't catch that — how many guests will be staying?",

    # Dining concierge — first-activation introductions
    "alice-dining-intro-reserve.wav": (
        "Hello, I'm Alice, your dining concierge. I'd be delighted to reserve a table for you. "
        "What date would you like to dine with us?"
    ),
    "alice-dining-intro-order.wav": (
        "Hello, I'm Alice, your dining concierge. I'd love to help you choose something delicious. "
        "Tell me what you're in the mood for, and I'll find it on our menu."
    ),

    # Dining concierge — follow-up lines
    "alice-dining-greeting.wav": (
        "Hello, I'm Alice. I can reserve a table for you, or help you find something delicious to eat. "
        "Which would you like?"
    ),
    "alice-ask-dining-date.wav": "Lovely. What date would you like to dine with us?",
    "alice-ask-dining-time.wav": "And what time shall I look for?",
    "alice-ask-party-size.wav": "And how many guests will be joining you?",
    "alice-checking-tables.wav": "One moment — let me check which tables are free for you.",
    "alice-ask-cravings.wav": (
        "Wonderful. Tell me what you're in the mood for, and I'll find something on the menu for you."
    ),
    "alice-checking-menu.wav": "Let me look through the menu for you.",
    "alice-retry-dining-date.wav": "I didn't quite catch that date. When would you like to dine with us?",
    "alice-retry-dining-time.wav": "I'm sorry, what time would you like?",
    "alice-retry-party-size.wav": "I didn't catch that — how many guests will be joining you?",

    # Delivery concierge — first-activation introductions
    "alice-delivery-intro-choose.wav": (
        "Hello, I'm Alice, your delivery concierge. Tell me what you're in the mood for, "
        "and I'll find the perfect dish on our menu."
    ),
    "alice-delivery-intro-track.wav": (
        "Hello, I'm Alice, your delivery concierge. One moment while I check on your order."
    ),
    "alice-delivery-intro-question.wav": (
        "Hello, I'm Alice, your delivery concierge. What would you like to know?"
    ),

    # Delivery concierge — follow-up lines
    "alice-checking-order.wav": "One moment while I check on your order.",
    "alice-ask-question.wav": "Of course — what would you like to know?",
}


def run():
    out_dir = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "audio")
    )
    os.makedirs(out_dir, exist_ok=True)

    pipeline = KPipeline(lang_code="a")

    for filename, text in PROMPTS.items():
        chunks = [audio for _, _, audio in pipeline(text, voice=VOICE)]
        audio = chunks[0] if len(chunks) == 1 else np.concatenate(chunks)
        path = os.path.join(out_dir, filename)
        sf.write(path, audio, 24000)
        print(f"Saved {path}")

    print(f"\nDone. {len(PROMPTS)} files written to {out_dir}")


if __name__ == "__main__":
    run()