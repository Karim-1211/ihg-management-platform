"""Replaces the demo restaurant's imagery with a curated, licence-verified
set led by plated fine-dining photography. Safe to re-run; existing assets
for this restaurant are deactivated and the new set written in order.

Sources: Pexels (Pexels licence) and Unsplash (Unsplash licence) — both
free for commercial use.

Run from backend/:
    python seed_restaurant_media.py
"""
from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401 — needed for FK resolution
from app.models.media import MediaAsset, MediaEntityType, MediaSourceType
from app.models.restaurant import Restaurant
from app.models.user import User, RoleEnum

IMAGES = [
    ("https://images.pexels.com/photos/8697542/pexels-photo-8697542.jpeg?auto=compress&cs=tinysrgb&w=2400", "Evening service", "Gourmet steak dinner served with red wine"),
    ("https://images.unsplash.com/photo-1695641738244-25e5355e9a42?fm=jpg&q=80&w=2600&auto=format&fit=crop", "Candlelit tables", "Candlelit table setting in an intimate dining room"),
    ("https://images.pexels.com/photos/3791089/pexels-photo-3791089.jpeg?auto=compress&cs=tinysrgb&w=2400", "From the kitchen", "Duck breast with crispy kale and a rich sauce"),
    ("https://images.unsplash.com/photo-1606659894125-40824878b6ce?fm=jpg&q=80&w=2600&auto=format&fit=crop", "The dining room", "Lit candles on a dining table"),
    ("https://images.pexels.com/photos/299348/pexels-photo-299348.jpeg?auto=compress&cs=tinysrgb&w=2400", "Chef's plate", "Beef with vegetables and sauce, plated for fine dining"),
    ("https://images.unsplash.com/photo-1660380775592-5647075c8ea0?fm=jpg&q=80&w=2400&auto=format&fit=crop", "Seasonal plates", "Plated dish served with a glass of wine"),
    ("https://images.unsplash.com/photo-1750124933194-e021f47b5f8b?fm=jpg&q=80&w=1800&auto=format&fit=crop", "Signature cocktails", "Craft cocktail in a coupe glass"),
    ("https://images.unsplash.com/photo-1760982192590-de2b005bb4d5?fm=jpg&q=80&w=2400&auto=format&fit=crop", "The bar", "Bar counter with bottles and stools"),
]


def run():
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).order_by(Restaurant.created_at).first()
        if not restaurant:
            raise RuntimeError("No restaurant found.")

        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        created_by = admin.id if admin else None

        existing = db.query(MediaAsset).filter(
            MediaAsset.entity_type == MediaEntityType.RESTAURANT,
            MediaAsset.entity_id == restaurant.id,
        ).all()
        for row in existing:
            row.is_active = False
            row.is_primary = False

        for index, (url, caption, alt_text) in enumerate(IMAGES):
            asset = db.query(MediaAsset).filter(
                MediaAsset.entity_type == MediaEntityType.RESTAURANT,
                MediaAsset.entity_id == restaurant.id,
                MediaAsset.url == url,
            ).first()
            if asset is None:
                db.add(MediaAsset(
                    entity_type=MediaEntityType.RESTAURANT,
                    entity_id=restaurant.id,
                    source_type=MediaSourceType.EXTERNAL_URL,
                    url=url, caption=caption, alt_text=alt_text,
                    sort_order=index, is_primary=index == 0, is_active=True,
                    restaurant_id=restaurant.id, created_by=created_by,
                ))
            else:
                asset.caption, asset.alt_text, asset.sort_order = caption, alt_text, index
                asset.is_primary, asset.is_active = index == 0, True
                asset.restaurant_id, asset.created_by = restaurant.id, created_by

        db.commit()
        print(f"Replaced imagery for {restaurant.name}: {len(IMAGES)} active assets, {len(existing)} previous deactivated.")
        print("NOTE: illustrative demo stock imagery only.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()