"""Stocks the restaurant pantry and links every dish on the menu to the
ingredients it consumes, so confirming an order automatically deducts
stock (inventory_service.deduct_stock_for_order reads these recipe rows —
without them, nothing is ever deducted).

Idempotent: re-running updates quantities in place rather than duplicating,
and removes recipe lines that are no longer part of a dish.

Run from backend/ AFTER seed_restaurant_menu.py:
    python seed_inventory_and_recipes.py
"""
from decimal import Decimal

from app.core.database import SessionLocal
# Imported so SQLAlchemy can resolve every foreign key at flush time.
from app.models.hotel import Hotel  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.inventory import InventoryItem, RecipeIngredient
from app.models.restaurant import MenuCategory, MenuItem, Restaurant

# (name, unit, starting quantity, low-stock threshold)
# Quantities are deliberately generous so a demo can place many orders
# before anything runs out, while thresholds are high enough that steady
# ordering will eventually trigger a real LOW_STOCK_ALERT.
INGREDIENTS = [
    # Proteins
    ("Prawns", "kg", "25", "5"),
    ("Chicken Breast", "kg", "40", "5"),
    ("Mutton", "kg", "30", "5"),
    ("Hilsa Fish", "kg", "20", "4"),
    ("Sea Bass", "kg", "25", "5"),
    ("Lamb Shoulder", "kg", "25", "5"),
    ("Wagyu Beef Mince", "kg", "15", "3"),
    ("Crab Meat", "kg", "10", "2"),

    # Dairy
    ("Burrata", "kg", "8", "2"),
    ("Paneer", "kg", "12", "3"),
    ("Yoghurt", "kg", "30", "5"),
    ("Double Cream", "L", "20", "4"),
    ("Milk", "L", "60", "10"),
    ("Butter", "kg", "20", "4"),
    ("Aged Cheddar", "kg", "8", "2"),
    ("Cream Cheese", "kg", "10", "2"),
    ("Vanilla Ice Cream", "L", "15", "3"),

    # Produce
    ("Aubergine", "kg", "20", "4"),
    ("Potatoes", "kg", "50", "10"),
    ("Tomatoes", "kg", "35", "6"),
    ("Chestnut Mushrooms", "kg", "15", "3"),
    ("Cauliflower", "kg", "20", "4"),
    ("Onions", "kg", "40", "8"),
    ("Limes", "kg", "15", "3"),
    ("Mango", "kg", "20", "4"),
    ("Seasonal Fruit", "kg", "25", "5"),
    ("Fresh Mint", "kg", "5", "1"),
    ("Coriander", "kg", "5", "1"),
    ("Peppers", "kg", "18", "3"),
    ("Ginger", "kg", "10", "2"),
    ("Green Chillies", "kg", "6", "1"),
    ("Kale", "kg", "10", "2"),

    # Pantry
    ("Aged Basmati Rice", "kg", "60", "10"),
    ("Red Lentils", "kg", "25", "5"),
    ("Black Lentils", "kg", "25", "5"),
    ("Gram Flour", "kg", "20", "4"),
    ("Plain Flour", "kg", "30", "5"),
    ("Sugar", "kg", "30", "5"),
    ("Dark Chocolate", "kg", "12", "3"),
    ("Pistachios", "kg", "8", "2"),
    ("Almonds", "kg", "8", "2"),
    ("Cashew Nuts", "kg", "10", "2"),
    ("Coconut Milk", "L", "20", "4"),
    ("Tamarind Paste", "kg", "6", "1"),
    ("Mustard Paste", "kg", "6", "1"),
    ("Saffron", "g", "200", "40"),
    ("Green Cardamom", "g", "500", "100"),
    ("Chaat Masala", "kg", "5", "1"),
    ("Palm Jaggery", "kg", "8", "2"),
    ("Rose Water", "L", "4", "1"),
    ("Brioche Buns", "pcs", "120", "24"),
    ("Naan Bread", "pcs", "200", "40"),
    ("Fuchka Shells", "pcs", "300", "60"),
    ("Pastry Sheets", "pcs", "200", "40"),
    ("Eggs", "pcs", "240", "48"),
    ("White Beans", "kg", "12", "3"),

    # Bar & beverage
    ("Assam Tea Leaves", "kg", "6", "1"),
    ("Coffee Beans", "kg", "12", "2"),
    ("Soda Water", "L", "40", "8"),
    ("Sparkling Water", "btl", "120", "24"),
    ("House Red Wine", "btl", "60", "12"),
    ("House White Wine", "btl", "60", "12"),
    ("Prosecco", "btl", "40", "8"),
    ("Spiced Rum", "L", "12", "3"),
    ("Vodka", "L", "12", "3"),
    ("Coffee Liqueur", "L", "8", "2"),
    ("Brandy", "L", "6", "2"),
    ("Draft Lager", "L", "100", "20"),
    ("Orange Aperitif", "L", "8", "2"),
]

# Dish name -> [(ingredient name, quantity consumed per single order)]
RECIPES = {
    # Starters
    "Shorshe Prawn": [("Prawns", "0.18"), ("Mustard Paste", "0.03"), ("Green Chillies", "0.01")],
    "Beguni & Tamarind": [("Aubergine", "0.2"), ("Gram Flour", "0.08"), ("Tamarind Paste", "0.03")],
    "Chicken Shashlik Skewers": [("Chicken Breast", "0.2"), ("Yoghurt", "0.06"), ("Peppers", "0.08"), ("Fresh Mint", "0.01")],
    "Mulligatawny": [("Red Lentils", "0.12"), ("Coconut Milk", "0.15"), ("Onions", "0.06")],
    "Burrata & Heirloom Tomato": [("Burrata", "0.15"), ("Tomatoes", "0.18")],
    "Fuchka Chaat": [("Fuchka Shells", "6"), ("Potatoes", "0.12"), ("Tamarind Paste", "0.02"), ("Coriander", "0.01")],
    "Tandoori Mushrooms": [("Chestnut Mushrooms", "0.18"), ("Yoghurt", "0.05")],
    "Crab Cakes & Kasundi": [("Crab Meat", "0.14"), ("Plain Flour", "0.04"), ("Mustard Paste", "0.02"), ("Eggs", "1")],

    # Mains
    "Kacchi Biryani": [("Mutton", "0.28"), ("Aged Basmati Rice", "0.22"), ("Saffron", "0.3"), ("Yoghurt", "0.1"), ("Onions", "0.1")],
    "Ilish Paturi": [("Hilsa Fish", "0.26"), ("Mustard Paste", "0.04"), ("Coconut Milk", "0.08")],
    "Butter Chicken": [("Chicken Breast", "0.25"), ("Tomatoes", "0.2"), ("Butter", "0.05"), ("Double Cream", "0.06")],
    "Chargrilled Sea Bass": [("Sea Bass", "0.3"), ("Limes", "0.04"), ("Kale", "0.1"), ("Green Chillies", "0.01")],
    "Daal Makhani": [("Black Lentils", "0.15"), ("Double Cream", "0.05"), ("Butter", "0.03"), ("Naan Bread", "2")],
    "Wagyu Bistro Burger": [("Wagyu Beef Mince", "0.2"), ("Brioche Buns", "1"), ("Aged Cheddar", "0.04"), ("Potatoes", "0.2")],
    "Roasted Cauliflower Steak": [("Cauliflower", "0.35"), ("White Beans", "0.1"), ("Green Chillies", "0.01")],
    "Lamb Rezala": [("Lamb Shoulder", "0.28"), ("Yoghurt", "0.1"), ("Cashew Nuts", "0.04"), ("Green Cardamom", "2")],

    # Desserts
    "Mishti Doi Panna Cotta": [("Yoghurt", "0.12"), ("Palm Jaggery", "0.05"), ("Pistachios", "0.02")],
    "Chocolate & Cardamom Fondant": [("Dark Chocolate", "0.09"), ("Butter", "0.04"), ("Eggs", "2"), ("Green Cardamom", "1"), ("Vanilla Ice Cream", "0.08")],
    "Rasmalai Cheesecake": [("Cream Cheese", "0.12"), ("Milk", "0.1"), ("Saffron", "0.2"), ("Almonds", "0.02")],
    "Seasonal Fruit Plate": [("Seasonal Fruit", "0.25")],
    "Pistachio Kulfi": [("Milk", "0.2"), ("Pistachios", "0.03"), ("Sugar", "0.04")],
    "Payesh Crème Brûlée": [("Milk", "0.18"), ("Aged Basmati Rice", "0.04"), ("Sugar", "0.05"), ("Eggs", "1")],
    "Mango & Passionfruit Pavlova": [("Eggs", "2"), ("Sugar", "0.08"), ("Mango", "0.15"), ("Double Cream", "0.06")],
    "Dark Chocolate Truffles": [("Dark Chocolate", "0.08"), ("Double Cream", "0.03")],

    # Drinks
    "Masala Chai": [("Assam Tea Leaves", "0.012"), ("Milk", "0.15"), ("Green Cardamom", "1"), ("Sugar", "0.015")],
    "Single-Origin Cold Brew": [("Coffee Beans", "0.03")],
    "Fresh Lime Soda": [("Limes", "0.06"), ("Soda Water", "0.3"), ("Sugar", "0.01")],
    "Mango Lassi": [("Mango", "0.12"), ("Yoghurt", "0.15"), ("Sugar", "0.02")],
    "House Red or White": [("House Red Wine", "0.2")],
    "Sparkling Water": [("Sparkling Water", "1")],
    "Espresso": [("Coffee Beans", "0.018")],
    "Rose & Cardamom Iced Tea": [("Assam Tea Leaves", "0.01"), ("Rose Water", "0.01"), ("Green Cardamom", "0.5")],

    # Happy Hour
    "Sunset Spritz": [("Prosecco", "0.25"), ("Orange Aperitif", "0.05"), ("Soda Water", "0.1")],
    "Bay of Bengal Mule": [("Spiced Rum", "0.05"), ("Limes", "0.03"), ("Ginger", "0.02"), ("Fresh Mint", "0.005")],
    "Espresso Martini": [("Vodka", "0.05"), ("Coffee Liqueur", "0.025"), ("Coffee Beans", "0.018")],
    "House Sangria Jug": [("House Red Wine", "0.75"), ("Brandy", "0.05"), ("Seasonal Fruit", "0.15")],
    "Draft Beer": [("Draft Lager", "0.5")],
    "Chilli Paneer Bites": [("Paneer", "0.15"), ("Peppers", "0.06"), ("Green Chillies", "0.01")],
    "Masala Fries": [("Potatoes", "0.25"), ("Chaat Masala", "0.01"), ("Coriander", "0.005")],
    "Mini Shingara Basket": [("Pastry Sheets", "6"), ("Potatoes", "0.12"), ("Tamarind Paste", "0.02")],
}


def run():
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).order_by(Restaurant.created_at).first()
        if not restaurant:
            raise RuntimeError("No restaurant found. Seed a restaurant first.")

        print(f"Stocking the pantry for: {restaurant.name}\n")

        # ---- 1. Inventory items -------------------------------------------
        created_items = 0
        updated_items = 0
        items_by_name: dict[str, InventoryItem] = {}

        for name, unit, quantity, minimum in INGREDIENTS:
            item = (
                db.query(InventoryItem)
                .filter(InventoryItem.restaurant_id == restaurant.id, InventoryItem.name == name)
                .first()
            )
            if item is None:
                item = InventoryItem(
                    restaurant_id=restaurant.id,
                    name=name,
                    unit=unit,
                    current_quantity=Decimal(quantity),
                    minimum_quantity=Decimal(minimum),
                    is_active=True,
                )
                db.add(item)
                created_items += 1
            else:
                # Existing stock levels are left alone — only the unit, the
                # threshold and the active flag are corrected, so a re-run
                # never wipes out real consumption history.
                item.unit = unit
                item.minimum_quantity = Decimal(minimum)
                item.is_active = True
                updated_items += 1
            db.flush()
            items_by_name[name] = item

        print(f"  Inventory: {created_items} new item(s), {updated_items} existing item(s) kept\n")

        # ---- 2. Recipes ----------------------------------------------------
        menu_items = (
            db.query(MenuItem)
            .join(MenuCategory, MenuItem.category_id == MenuCategory.id)
            .filter(MenuCategory.restaurant_id == restaurant.id)
            .all()
        )
        menu_by_name = {mi.name: mi for mi in menu_items}

        linked = 0
        updated_links = 0
        removed_links = 0
        missing_dishes = []

        for dish_name, lines in RECIPES.items():
            menu_item = menu_by_name.get(dish_name)
            if menu_item is None:
                missing_dishes.append(dish_name)
                continue

            wanted_ids = set()
            for ingredient_name, quantity in lines:
                ingredient = items_by_name.get(ingredient_name)
                if ingredient is None:
                    print(f"  ! '{ingredient_name}' not found in inventory — skipped for {dish_name}")
                    continue
                wanted_ids.add(ingredient.id)

                recipe = (
                    db.query(RecipeIngredient)
                    .filter(
                        RecipeIngredient.menu_item_id == menu_item.id,
                        RecipeIngredient.inventory_item_id == ingredient.id,
                    )
                    .first()
                )
                if recipe is None:
                    db.add(RecipeIngredient(
                        menu_item_id=menu_item.id,
                        inventory_item_id=ingredient.id,
                        quantity_required=Decimal(quantity),
                    ))
                    linked += 1
                else:
                    recipe.quantity_required = Decimal(quantity)
                    updated_links += 1

            # Drop any ingredient that is no longer part of this dish.
            for stale in db.query(RecipeIngredient).filter(RecipeIngredient.menu_item_id == menu_item.id).all():
                if stale.inventory_item_id not in wanted_ids:
                    db.delete(stale)
                    removed_links += 1

        db.commit()

        print(f"  Recipes: {linked} new link(s), {updated_links} updated, {removed_links} stale link(s) removed")

        if missing_dishes:
            print(f"\n  NOTE: no dish on the menu matches these recipe names — check spelling:")
            for name in missing_dishes:
                print(f"    - {name}")

        unlinked = [
            mi.name for mi in menu_items
            if not db.query(RecipeIngredient).filter(RecipeIngredient.menu_item_id == mi.id).first()
        ]
        if unlinked:
            print(f"\n  WARNING: {len(unlinked)} dish(es) have NO recipe and will not deduct stock:")
            for name in unlinked:
                print(f"    - {name}")
        else:
            print("\n  Every dish on the menu now deducts stock when an order is confirmed.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()