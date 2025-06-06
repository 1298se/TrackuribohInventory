import uuid
from datetime import datetime
from typing import List, Any

from sqlalchemy import ForeignKey, UniqueConstraint, DateTime, String, Computed, Index
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import relationship, mapped_column, Mapped
from typing_extensions import Optional
from uuid_extensions import uuid7

from core.models.base import Base
from core.services.schemas.schema import ProductType

catalog_tablename = "catalog"
set_tablename = "set"
product_tablename = "product"
sku_tablename = "sku"
condition_tablename = "condition"
printing_tablename = "printing"
language_tablename = "language"


"""
    The franchise, such as Pokemon or YuGiOh
"""


class Catalog(Base):
    __tablename__ = catalog_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    # Maps to a TCGPlayer "Category"
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    modified_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    display_name: Mapped[str]


class Set(Base):
    __tablename__ = set_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    # Maps to a TCGPlayer "Group"
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    name: Mapped[str]
    code: Mapped[str]
    release_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    modified_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    catalog_id: Mapped[int] = mapped_column(ForeignKey(f"{catalog_tablename}.id"))
    catalog: Mapped["Catalog"] = relationship()
    products: Mapped[list["Product"]] = relationship(back_populates="set")


class Product(Base):
    __tablename__ = product_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    # Blue-Eyes White Dragon
    name: Mapped[str] = mapped_column(index=True)
    # name but without hyphens, semicolons, etc
    clean_name: Mapped[str | None] = mapped_column(index=True)
    image_url: Mapped[Optional[str]]
    set_id: Mapped[int] = mapped_column(ForeignKey(f"{set_tablename}.id"))
    set: Mapped["Set"] = relationship(back_populates="products")
    skus: Mapped[List["SKU"]] = relationship(back_populates="product")
    product_type: Mapped[ProductType]
    data: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)

    # New columns for performance-backed full-text search
    rarity: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    number: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    set_name: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    search_vector: Mapped[TSVECTOR] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(rarity, '') || ' ' || coalesce(number, '') || ' ' || coalesce(set_name, ''))",
            persisted=True,
        ),
    )
    __table_args__ = (
        # GIN index for fast full-text search on the persisted search_vector
        Index("ix_product_search_vector", "search_vector", postgresql_using="gin"),
    )

    @property
    def tcgplayer_url(self) -> str:
        return f"www.tcgplayer.com/product/{self.tcgplayer_id}"


class SKU(Base):
    __tablename__ = sku_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    product_id: Mapped[int] = mapped_column(ForeignKey(f"{product_tablename}.id"))
    product: Mapped["Product"] = relationship(back_populates="skus")
    printing_id: Mapped[int] = mapped_column(ForeignKey(f"{printing_tablename}.id"))
    printing: Mapped["Printing"] = relationship()
    condition_id: Mapped[int] = mapped_column(ForeignKey(f"{condition_tablename}.id"))
    condition: Mapped["Condition"] = relationship()
    language_id: Mapped[int] = mapped_column(ForeignKey(f"{language_tablename}.id"))
    language: Mapped["Language"] = relationship()


class Condition(Base):
    __tablename__ = condition_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    name: Mapped[str] = mapped_column(index=True)
    abbreviation: Mapped[str]

    # Add unique constraint for tcgplayer_id
    __table_args__ = (
        UniqueConstraint("tcgplayer_id", name="uq_condition_tcgplayer_id"),
    )


class Printing(Base):
    __tablename__ = printing_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    catalog_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{catalog_tablename}.id"))
    name: Mapped[str] = mapped_column(index=True)

    # Add unique constraint for catalog_id and tcgplayer_id combination
    __table_args__ = (
        UniqueConstraint(
            "catalog_id", "tcgplayer_id", name="uq_printing_catalog_id_tcgplayer_id"
        ),
    )


class Language(Base):
    __tablename__ = language_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    name: Mapped[str] = mapped_column(index=True)
    abbreviation: Mapped[str]

    # Add unique constraint for tcgplayer_id
    __table_args__ = (
        UniqueConstraint("tcgplayer_id", name="uq_language_tcgplayer_id"),
    )
