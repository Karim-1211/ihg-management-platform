"""Gives each individual room its own headline and character line.

Description, amenities and view live on the room TYPE — which is correct, a
hotel describes a category once. But two suites of the same type reading
identically makes a guest wonder why they'd choose one over another.

Rooms have no description column, so this writes a small per-room file the
frontend reads. Nothing in the schema changes.

Keys use the CURRENT room numbers (101-103, 201-202, 301-302, 401-402).

Run from backend/:
    python seed_room_character.py
"""
import json
import os

from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.hotel import Room, RoomType
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import User  # noqa: F401

# One line per room, describing what distinguishes THIS room from others of
# the same type. Each line matches what the room's photographs actually show.
CHARACTER = {
    "101": {
        "headline": "Ground floor, opening to the garden.",
        "note": "The quietest of the standard rooms — no corridor traffic past the door, and the garden terrace a few steps away.",
    },
    "102": {
        "headline": "A corner room, with light on two sides.",
        "note": "Tall windows and a small balcony at the end of the first-floor corridor, with morning sun from the east.",
    },
    "103": {
        "headline": "The city, framed and double-glazed.",
        "note": "Faces Gulshan Avenue, with glazing thick enough that the view is the only thing that reaches you. The guest lounge on this floor shares the same outlook.",
    },
    "201": {
        "headline": "The corner suite, with the city at your window.",
        "note": "A full corner of the second floor, with windows on two aspects and a balcony looking out across the rooftops.",
    },
    "202": {
        "headline": "Open water, from the moment you wake.",
        "note": "The bed faces the sea, and the balcony is deep enough to sit out on properly — coffee at sunrise is the point of this room.",
    },
    "301": {
        "headline": "Quiet at the end of the corridor, facing the lake.",
        "note": "The farthest suite from the lift, with the garden below, the lake beyond it and the mountains behind — and nothing to hear at all.",
    },
    "302": {
        "headline": "Wake to the water, on the quiet side.",
        "note": "Set away from the avenue entirely. At dusk the lake goes gold and the city disappears behind you.",
    },
    "401": {
        "headline": "The longest view in the house.",
        "note": "Top floor, facing the water with the ridgeline behind it — the balcony is deep enough to eat breakfast on.",
    },
    "402": {
        "headline": "High, quiet, and facing the ridgeline.",
        "note": "A window seat positioned for the morning, when the light comes up behind the mountains.",
    },
}

OUTPUT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "room-character.json")
)


def run():
    db = SessionLocal()
    try:
        rooms = db.query(Room).order_by(Room.room_number).all()
        types = {rt.id: rt for rt in db.query(RoomType).all()}

        data = {}
        missing = []
        print(f"\n  {len(rooms)} room(s):\n")
        for room in rooms:
            rt = types.get(room.room_type_id)
            entry = CHARACTER.get(room.room_number)
            if not entry:
                missing.append(room.room_number)
                print(f"    Room {room.room_number:<6} {rt.name if rt else '?':<24} NO CHARACTER SET")
                continue
            data[room.room_number] = entry
            print(f"    Room {room.room_number:<6} {rt.name if rt else '?':<24} {entry['headline'][:46]}")

        os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
        with open(OUTPUT, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n  {len(data)} room(s) written to {OUTPUT}")
        if missing:
            print(f"\n  WARNING: no character set for room(s) {', '.join(missing)}.")
        print()
    finally:
        db.close()


if __name__ == "__main__":
    run()