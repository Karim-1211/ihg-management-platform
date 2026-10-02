"""Enriches room-type detail and the hotel's own description.

A luxury room page needs two things: what is in the room, and what comes
with the hotel. The first lives on RoomType; the second has no column, so
it is written into Hotel.description, which the room page then presents as
a facilities list.

Run from backend/:
    python seed_room_details.py                  # show what's stored
    python seed_room_details.py --seed           # fill in anything empty
    python seed_room_details.py --seed --force   # rewrite everything
"""
import sys

from app.core.database import SessionLocal
from app.models.hotel import Hotel, RoomType

# The hotel's own facilities, included with every stay. Written into the
# hotel description with a marker the frontend can split on, so no schema
# change is needed for what is really presentation copy.
FACILITIES_MARKER = "\n\nFACILITIES:"

HOTEL_DESCRIPTION = (
    "IHG Grand Dhaka sits on the quiet side of Gulshan Avenue, close enough to the city's "
    "restaurants and offices to walk out into them, far enough from the traffic to sleep "
    "through it. Eighty-four rooms and suites, a restaurant that takes an ordinary Tuesday "
    "as seriously as a celebration, and a team that anticipates rather than reacts."
)

HOTEL_FACILITIES = [
    "Rooftop infinity pool, open 6am – 10pm",
    "Full-service spa & hammam",
    "24-hour fitness studio with personal training",
    "Complimentary breakfast, served 6:30 – 10:30am",
    "All-day dining at IHG Grand Dhaka Restaurant",
    "Bar & terrace, open until late",
    "24-hour in-room dining",
    "Complimentary airport transfer on request",
    "Business centre & meeting rooms",
    "Concierge & valet parking",
    "Laundry and same-day pressing",
    "Complimentary high-speed Wi-Fi throughout",
]

BASE_AMENITIES = [
    "Air conditioning with individual climate control",
    "Complimentary high-speed Wi-Fi",
    '55" smart television',
    "Tea & coffee facilities",
    "In-room digital safe",
    "Daily housekeeping",
    "Direct-dial telephone",
    "Blackout curtains",
    "Hairdryer",
    "Iron & ironing board",
    "24-hour room service",
]

PROFILES = {
    "Deluxe Suite": {
        "description": (
            "Our most generous room, taking the building's quiet corner across a full floor. "
            "A separate sitting area with deep armchairs, floor-to-ceiling windows that catch the "
            "afternoon light, and a writing desk positioned to face the view rather than the wall.\n\n"
            "The bedroom is dressed in linen and low light, with a pillow menu if the one you're "
            "given isn't quite right. The marble bathroom has a soaking tub beneath a window and a "
            "separate rainfall shower. Evenings bring turndown service and, if you'd like it, a "
            "nightcap sent up from the bar.\n\n"
            "Breakfast is included, as is full use of the pool, spa and fitness studio. A stay here "
            "is meant to feel unhurried."
        ),
        "view_type": "City View",
        "bed_configuration": "1 King Bed",
        "has_balcony": True,
        "has_bathtub": True,
        "extra_amenities": [
            "Separate lounge and seating area",
            "Private furnished balcony",
            "Marble bathroom with soaking tub",
            "Separate rainfall shower",
            "Nespresso machine & complimentary pods",
            "Complimentary minibar, restocked daily",
            "Egyptian cotton bathrobes & slippers",
            "Evening turndown service",
            "Pillow menu",
            "Executive work desk",
            "Bulgari bath amenities",
            "Complimentary daily newspaper",
            "Welcome fruit & still water",
        ],
    },
    "Standard Room": {
        "description": (
            "An unfussy, well-proportioned room that gets the essentials right, and gets out of the "
            "way. A firm bed, curtains that actually black out, and a desk you can genuinely work at.\n\n"
            "The bathroom is compact but properly finished, with a walk-in rainfall shower and full-size "
            "toiletries. Everything you need for a short stay, nothing you'll never use.\n\n"
            "Breakfast and full use of the pool, spa and fitness studio are included, exactly as they "
            "are for every room in the house."
        ),
        "view_type": "Garden View",
        "bed_configuration": "1 Queen Bed",
        "has_balcony": False,
        "has_bathtub": False,
        "extra_amenities": [
            "Walk-in rainfall shower",
            "Work desk & ergonomic chair",
            "Full wardrobe with luggage rack",
            "Full-size bath amenities",
            "Bottled still water, replenished daily",
        ],
    },
    "Lake View Room": {
        "description": (
            "Set on the quiet side of the building, with a private balcony looking out over the water. "
            "Best at dusk, when the light turns gold and the city noise drops away entirely.\n\n"
            "Inside, warm materials and a bed positioned to face the window. The bathroom has a deep "
            "soaking tub and a separate shower, with robes and slippers waiting.\n\n"
            "Breakfast, the rooftop pool, the spa and the fitness studio are all included."
        ),
        "view_type": "Lake View",
        "bed_configuration": "1 King Bed",
        "has_balcony": True,
        "has_bathtub": True,
        "extra_amenities": [
            "Private balcony with lounge seating",
            "Deep soaking tub",
            "Separate rainfall shower",
            "Nespresso machine",
            "Bathrobes & slippers",
            "Work desk",
            "Premium bath amenities",
        ],
    },
    "Sea View Room": {
        "description": (
            "Wide water views from a room built around them. The bed faces the window, and the balcony "
            "is deep enough to sit out on properly rather than just stand.\n\n"
            "Mornings here are the point: coffee on the balcony, the water changing colour as the sun "
            "comes up. The bathroom has a soaking tub and a separate shower.\n\n"
            "Breakfast, the rooftop pool, the spa and the fitness studio are included with every night."
        ),
        "view_type": "Sea View",
        "bed_configuration": "1 King Bed",
        "has_balcony": True,
        "has_bathtub": True,
        "extra_amenities": [
            "Deep private balcony with seating",
            "Soaking tub with a view",
            "Separate rainfall shower",
            "Nespresso machine",
            "Bathrobes & slippers",
            "Premium bath amenities",
        ],
    },
    "Mountain View Room": {
        "description": (
            "Quiet, high, and facing the ridgeline. Warm materials, a generous bed, and a window seat "
            "that makes a convincing argument for staying in.\n\n"
            "The balcony catches the morning sun. The bathroom is finished in stone, with a walk-in "
            "rainfall shower and full-size amenities.\n\n"
            "Breakfast, the rooftop pool, the spa and the fitness studio are included."
        ),
        "view_type": "Mountain View",
        "bed_configuration": "1 King Bed",
        "has_balcony": True,
        "has_bathtub": False,
        "extra_amenities": [
            "Private balcony",
            "Window seat",
            "Walk-in rainfall shower",
            "Nespresso machine",
            "Bathrobes & slippers",
            "Work desk",
        ],
    },
}

DEFAULT_PROFILE = {
    "description": (
        "A comfortable, quietly finished room with everything needed for a restful stay — a proper "
        "bed, a usable desk, and a bathroom that doesn't feel like an afterthought.\n\n"
        "Breakfast, the rooftop pool, the spa and the fitness studio are included with every night."
    ),
    "view_type": "City View",
    "bed_configuration": "1 Queen Bed",
    "has_balcony": False,
    "has_bathtub": False,
    "extra_amenities": ["Walk-in rainfall shower", "Work desk", "Wardrobe", "Full-size bath amenities"],
}

# Thin values from the original seed count as gaps: a two-word description
# on a $150 suite is worse than an obviously missing one.
MIN_DESCRIPTION_CHARS = 200
MIN_AMENITIES = 8


def needs_work(rt) -> list[str]:
    gaps = []
    if not rt.description or len(rt.description) < MIN_DESCRIPTION_CHARS:
        gaps.append("description")
    if not rt.view_type:
        gaps.append("view")
    if not rt.bed_configuration:
        gaps.append("bed")
    if not rt.amenities or len(rt.amenities) < MIN_AMENITIES:
        gaps.append("amenities")
    return gaps


def main():
    do_seed = "--seed" in sys.argv
    force = "--force" in sys.argv

    db = SessionLocal()
    try:
        room_types = db.query(RoomType).order_by(RoomType.base_price.desc()).all()
        if not room_types:
            print("\n  No room types found. Run seed_data.py first.\n")
            return

        print(f"\n  {len(room_types)} room type(s):\n")
        for rt in room_types:
            gaps = needs_work(rt)
            desc_len = len(rt.description or "")
            amen = len(rt.amenities or [])
            status = f"thin: {', '.join(gaps)}" if gaps else "complete"
            print(f"    {rt.name:<22} ${float(rt.base_price):>7,.2f}  {desc_len:>4} chars, {amen:>2} amenities   {status}")
        print()

        if not do_seed:
            print("  Nothing changed. Re-run with --seed to fill the gaps,")
            print("  or --seed --force to rewrite everything.\n")
            return

        changed = 0
        for rt in room_types:
            profile = PROFILES.get(rt.name, DEFAULT_PROFILE)
            gaps = needs_work(rt)
            touched = []

            if force or "description" in gaps:
                rt.description = profile["description"]
                touched.append("description")
            if force or "view" in gaps:
                rt.view_type = profile["view_type"]
                touched.append("view")
            if force or "bed" in gaps:
                rt.bed_configuration = profile["bed_configuration"]
                touched.append("bed")
            if force or "amenities" in gaps:
                rt.amenities = BASE_AMENITIES + profile["extra_amenities"]
                touched.append(f"{len(rt.amenities)} amenities")
            if force:
                rt.has_balcony = profile["has_balcony"]
                rt.has_bathtub = profile["has_bathtub"]
                touched.append("balcony/bathtub")

            if touched:
                changed += 1
                print(f"  + {rt.name}: {', '.join(touched)}")

        # Hotel facilities — appended to the description behind a marker the
        # frontend splits on, so no migration is needed for presentation copy.
        hotel = db.query(Hotel).order_by(Hotel.created_at).first()
        if hotel:
            current = hotel.description or ""
            if force or FACILITIES_MARKER not in current:
                base = current.split(FACILITIES_MARKER)[0].strip()
                if force or len(base) < 120:
                    base = HOTEL_DESCRIPTION
                hotel.description = base + FACILITIES_MARKER + "\n" + "\n".join(f"- {f}" for f in HOTEL_FACILITIES)
                print(f"  + {hotel.name}: description and {len(HOTEL_FACILITIES)} hotel facilities")

        db.commit()
        print(f"\n  {changed} room type(s) updated.\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()