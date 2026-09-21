"""Seeds a full multi-section menu for the demo restaurant: Starters,
Mains, Desserts, Drinks and Happy Hour — exactly 8 dishes per section so
every menu tab renders at an identical height. Idempotent — safe to re-run.

Also cleans up leftovers from older seed data:
  * legacy categories (e.g. "Main Course") are merged into their canonical
    section and removed;
  * any dish not in this menu is deleted, or — if a past order references
    it — marked unavailable so order history stays intact. Unavailable
    dishes are hidden from the public menu.

Run from backend/:
    python seed_restaurant_menu.py
"""
from decimal import Decimal

from app.core.database import SessionLocal
# Imported so SQLAlchemy can resolve every foreign key at flush time
# (restaurants.hotel_id -> hotels.id, orders -> users, etc.).
from app.models.hotel import Hotel  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.restaurant import MenuCategory, MenuItem, OrderItem, Restaurant

# (name, description, price, dietary_tags, is_signature)
MENU = {
    "Starters": [
        ("Shorshe Prawn", "Bay prawns in a mustard and green chilli marinade, seared over charcoal.", "14.00", ["Gluten-Free", "Spicy"], False),
        ("Beguni & Tamarind", "Crisp gram-flour aubergine, sweet tamarind, toasted nigella.", "8.00", ["Vegan", "Vegetarian"], False),
        ("Chicken Shashlik Skewers", "Yoghurt-marinated chicken, charred peppers, mint chutney.", "12.00", ["Gluten-Free"], False),
        ("Mulligatawny", "Slow-simmered lentil and coconut broth, curry leaf oil.", "9.00", ["Vegetarian"], False),
        ("Burrata & Heirloom Tomato", "Creamy burrata, local tomatoes, basil oil, aged balsamic.", "16.00", ["Vegetarian", "Gluten-Free"], True),
        ("Fuchka Chaat", "Crisp semolina shells, spiced potato, tamarind water, fresh coriander.", "7.00", ["Vegetarian", "Spicy"], False),
        ("Tandoori Mushrooms", "Chestnut mushrooms in smoked yoghurt marinade, finished in the tandoor.", "10.00", ["Vegetarian", "Gluten-Free"], False),
        ("Crab Cakes & Kasundi", "Hand-picked crab, fresh herbs, a sharp Bengali mustard relish.", "15.00", [], False),
    ],
    "Mains": [
        ("Kacchi Biryani", "Mutton layered with aged basmati and saffron, sealed and slow-baked. Served with borhani.", "26.00", ["Spicy"], True),
        ("Ilish Paturi", "Hilsa wrapped in banana leaf with mustard and coconut, steamed to order.", "32.00", ["Gluten-Free"], True),
        ("Butter Chicken", "Tandoor chicken in a slow-reduced tomato and fenugreek gravy.", "24.00", ["Gluten-Free"], False),
        ("Chargrilled Sea Bass", "Whole sea bass, burnt lime, charred greens, green chilli salsa.", "34.00", ["Gluten-Free", "Dairy-Free"], False),
        ("Daal Makhani", "Black lentils simmered overnight, finished with cream. Served with naan.", "18.00", ["Vegetarian"], False),
        ("Wagyu Bistro Burger", "Wagyu patty, aged cheddar, house pickle, brioche bun, hand-cut fries.", "25.00", [], False),
        ("Roasted Cauliflower Steak", "Whole roasted cauliflower, white bean purée, pickled chilli, herb oil.", "19.00", ["Vegan", "Vegetarian", "Gluten-Free"], False),
        ("Lamb Rezala", "Slow-braised lamb in a delicate white gravy of yoghurt, cashew and cardamom.", "28.00", ["Gluten-Free", "Contains Nuts"], False),
    ],
    "Desserts": [
        ("Mishti Doi Panna Cotta", "Set sweet yoghurt, palm jaggery caramel, toasted pistachio.", "11.00", ["Vegetarian", "Gluten-Free", "Contains Nuts"], True),
        ("Chocolate & Cardamom Fondant", "Warm dark chocolate centre, green cardamom, vanilla bean ice cream.", "13.00", ["Vegetarian", "Contains Nuts"], False),
        ("Rasmalai Cheesecake", "Baked cheesecake infused with saffron milk, rose and almond.", "12.00", ["Vegetarian", "Contains Nuts"], False),
        ("Seasonal Fruit Plate", "Whatever the market had this morning, chilled and sliced.", "9.00", ["Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free"], False),
        ("Pistachio Kulfi", "Slow-reduced milk ice, pistachio and saffron, served on a stick.", "8.00", ["Vegetarian", "Gluten-Free", "Contains Nuts"], False),
        ("Payesh Crème Brûlée", "Fragrant rice pudding set as a brûlée, with a burnt jaggery crust.", "11.00", ["Vegetarian", "Gluten-Free"], False),
        ("Mango & Passionfruit Pavlova", "Crisp meringue, whipped cream, seasonal mango, passionfruit.", "12.00", ["Vegetarian", "Gluten-Free"], False),
        ("Dark Chocolate Truffles", "Four hand-rolled truffles, cocoa dusted — for the table.", "9.00", ["Vegan", "Gluten-Free", "Dairy-Free"], False),
    ],
    "Drinks": [
        ("Masala Chai", "Loose-leaf Assam, whole spice, brewed to order.", "4.00", ["Vegetarian"], False),
        ("Single-Origin Cold Brew", "Steeped eighteen hours, served over a single block of ice.", "5.00", ["Vegan", "Dairy-Free"], False),
        ("Fresh Lime Soda", "Sweet, salted, or both.", "4.00", ["Vegan", "Gluten-Free", "Dairy-Free"], False),
        ("Mango Lassi", "Seasonal mango, thick yoghurt, a pinch of cardamom.", "6.00", ["Vegetarian", "Gluten-Free"], False),
        ("House Red or White", "Ask your server for this week's pour.", "12.00", ["Vegan"], False),
        ("Sparkling Water", "Still available too, if you'd rather.", "3.00", ["Vegan", "Gluten-Free"], False),
        ("Espresso", "Double shot, house blend, pulled to order.", "3.00", ["Vegan", "Dairy-Free"], False),
        ("Rose & Cardamom Iced Tea", "Cold-steeped black tea, rose water, a hint of cardamom.", "5.00", ["Vegan", "Gluten-Free", "Dairy-Free"], False),
    ],
    "Happy Hour": [
        ("Sunset Spritz", "Bitter orange, prosecco, soda, orange twist.", "9.00", ["Vegan"], False),
        ("Bay of Bengal Mule", "Spiced rum, fresh lime, ginger, mint. Our most-ordered pour.", "10.00", ["Vegan"], True),
        ("Espresso Martini", "Vodka, fresh espresso, coffee liqueur, three beans.", "10.00", ["Vegan"], False),
        ("House Sangria Jug", "Red wine, seasonal fruit, a splash of brandy — serves two.", "18.00", ["Vegan"], False),
        ("Draft Beer", "Local lager, cold, half-price until seven.", "6.00", ["Vegan"], False),
        ("Chilli Paneer Bites", "Wok-tossed paneer, peppers, soy and chilli glaze.", "7.00", ["Vegetarian", "Spicy"], False),
        ("Masala Fries", "Hand-cut, chaat masala, coriander, lime.", "6.00", ["Vegan", "Vegetarian"], False),
        ("Mini Shingara Basket", "Six crisp pastries, spiced potato and pea, tamarind dip.", "6.00", ["Vegan", "Vegetarian"], False),
    ],
}

LEGACY_ALIASES = {
    "main course": "Mains",
    "main courses": "Mains",
    "main": "Mains",
    "starter": "Starters",
    "appetizer": "Starters",
    "appetizers": "Starters",
    "dessert": "Desserts",
    "sweets": "Desserts",
    "drink": "Drinks",
    "beverage": "Drinks",
    "beverages": "Drinks",
}


def is_referenced_by_orders(db, item_id) -> bool:
    return db.query(OrderItem).filter(OrderItem.menu_item_id == item_id).first() is not None


def retire_item(db, item) -> str:
    """Remove a dish that isn't on the current menu, without breaking any
    past order that references it."""
    if is_referenced_by_orders(db, item.id):
        item.is_available = False
        return "hidden"
    db.delete(item)
    return "deleted"


def run():
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).order_by(Restaurant.created_at).first()
        if not restaurant:
            raise RuntimeError("No restaurant found. Seed a restaurant first.")

        print(f"Seeding menu for: {restaurant.name}\n")
        created, updated = 0, 0
        canonical = {}

        for order, (category_name, items) in enumerate(MENU.items(), start=1):
            category = (
                db.query(MenuCategory)
                .filter(MenuCategory.restaurant_id == restaurant.id, MenuCategory.name == category_name)
                .first()
            )
            if category is None:
                category = MenuCategory(restaurant_id=restaurant.id, name=category_name, display_order=order)
                db.add(category)
                db.flush()
            else:
                category.display_order = order
            canonical[category_name] = category

            for name, description, price, tags, signature in items:
                item = (
                    db.query(MenuItem)
                    .filter(MenuItem.category_id == category.id, MenuItem.name == name)
                    .first()
                )
                if item is None:
                    db.add(MenuItem(
                        category_id=category.id, name=name, description=description,
                        price=Decimal(price), dietary_tags=tags, is_signature=signature, is_available=True,
                    ))
                    created += 1
                else:
                    item.description = description
                    item.price = Decimal(price)
                    item.dietary_tags = tags
                    item.is_signature = signature
                    item.is_available = True
                    updated += 1

            print(f"  {category_name}: {len(items)} dish(es)")

        db.flush()

        # 1. Merge legacy categories into their canonical section.
        for category in list(db.query(MenuCategory).filter(MenuCategory.restaurant_id == restaurant.id).all()):
            if category.name in MENU:
                continue
            target_name = LEGACY_ALIASES.get(category.name.strip().lower())
            items = db.query(MenuItem).filter(MenuItem.category_id == category.id).all()

            if target_name:
                target = canonical[target_name]
                for item in items:
                    item.category_id = target.id
                db.flush()
                db.delete(category)
                print(f"  Merged legacy category {category.name!r} -> {target_name!r}")
            else:
                # Unknown section from older data: hide its dishes so the menu
                # shows exactly the five canonical tabs.
                for item in items:
                    retire_item(db, item)
                print(f"  Retired non-standard category {category.name!r} ({len(items)} dish(es))")

        db.flush()

        # 2. Within each canonical section, retire anything not on this menu.
        retired = {"deleted": 0, "hidden": 0}
        for category_name, category in canonical.items():
            wanted = {row[0] for row in MENU[category_name]}
            for item in db.query(MenuItem).filter(MenuItem.category_id == category.id).all():
                if item.name not in wanted:
                    retired[retire_item(db, item)] += 1

        db.commit()
        print(
            f"\nDone. {created} new, {updated} updated, "
            f"{retired['deleted']} old dish(es) deleted, {retired['hidden']} hidden (kept for order history)."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()