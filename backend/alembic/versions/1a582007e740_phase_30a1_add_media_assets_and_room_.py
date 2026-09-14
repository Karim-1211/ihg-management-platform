"""phase 30a1 add media assets and room/menu visual attributes

Revision ID: 1a582007e740
Revises: 47cea9b21dbd
Create Date: 2026-09-14 19:23:43.379203

Purely additive: one new table (media_assets, polymorphic by entity_type +
entity_id, service-layer integrity per the locked 30a.1 design — no FK on
entity_id since it can reference Hotel/RoomType/Restaurant/MenuItem) plus
new nullable columns on room_types and menu_items. Nothing existing is
altered, renamed, or dropped. menu_items.image_url is deliberately left
untouched as a legacy fallback per the locked precedence:
MediaAsset primary -> legacy image_url -> no image.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '1a582007e740'
down_revision: Union[str, Sequence[str], None] = '47cea9b21dbd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New enum types for the media table.
    media_entity_type_enum = postgresql.ENUM(
        "HOTEL", "ROOM_TYPE", "RESTAURANT", "MENU_ITEM", name="media_entity_type_enum"
    )
    media_entity_type_enum.create(op.get_bind())

    media_source_type_enum = postgresql.ENUM(
        "EXTERNAL_URL", "UPLOADED", name="media_source_type_enum"
    )
    media_source_type_enum.create(op.get_bind())

    # 2. media_assets table.
    op.create_table(
        "media_assets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "entity_type",
            postgresql.ENUM("HOTEL", "ROOM_TYPE", "RESTAURANT", "MENU_ITEM", name="media_entity_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column(
            "source_type",
            postgresql.ENUM("EXTERNAL_URL", "UPLOADED", name="media_source_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("caption", sa.String(300), nullable=True),
        sa.Column("alt_text", sa.String(300), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("hotel_id", sa.UUID(), nullable=True),
        sa.Column("restaurant_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_media_assets_entity",
        "media_assets",
        ["entity_type", "entity_id", "is_active", "sort_order"],
    )

    # 3. RoomType — new visual/attribute columns, all nullable, all additive.
    op.add_column("room_types", sa.Column("view_type", sa.String(100), nullable=True))
    op.add_column("room_types", sa.Column("bed_configuration", sa.String(100), nullable=True))
    op.add_column("room_types", sa.Column("has_balcony", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("room_types", sa.Column("has_bathtub", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("room_types", sa.Column("amenities", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"))

    # 4. MenuItem — new attribute columns. image_url is untouched.
    op.add_column("menu_items", sa.Column("dietary_tags", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"))
    op.add_column("menu_items", sa.Column("is_signature", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("menu_items", "is_signature")
    op.drop_column("menu_items", "dietary_tags")

    op.drop_column("room_types", "amenities")
    op.drop_column("room_types", "has_bathtub")
    op.drop_column("room_types", "has_balcony")
    op.drop_column("room_types", "bed_configuration")
    op.drop_column("room_types", "view_type")

    op.drop_index("ix_media_assets_entity", table_name="media_assets")
    op.drop_table("media_assets")

    op.execute("DROP TYPE media_source_type_enum")
    op.execute("DROP TYPE media_entity_type_enum")