import uuid
from datetime import datetime
from typing import List, Any

from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship, mapped_column, Mapped
from typing_extensions import Optional
from uuid_extensions import uuid7

from app.models import Base
from app.services.schemas.schema import ProductType

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
    modified_date: Mapped[datetime]
    display_name: Mapped[str]


class Set(Base):
    __tablename__ = set_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    # Maps to a TCGPlayer "Group"
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    name: Mapped[str]
    code: Mapped[str]
    release_date: Mapped[datetime]
    modified_date: Mapped[datetime]
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
    clean_name: Mapped[str] = mapped_column(index=True)
    image_url: Mapped[Optional[str]]
    set_id: Mapped[int] = mapped_column(ForeignKey(f"{set_tablename}.id"))
    set: Mapped["Set"] = relationship(back_populates="products")
    skus: Mapped[List["SKU"]] = relationship(back_populates="product")
    product_type: Mapped[ProductType]
    data: Mapped[dict[str, Any]]

    @property
    def tcgplayer_url(self) -> str:
        return f"www.tcgplayer.com/product/{self.tcgplayer_id}"

    @property
    def rarity(self) -> str | None:
        return self.data["rarity"]



class SKU(Base):
    __tablename__ = sku_tablename

    id: Mapped[int] = mapped_column(primary_key=True)
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

    id: Mapped[int] = mapped_column(primary_key=True)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    catalog_id: Mapped[int] = mapped_column(ForeignKey(f"{catalog_tablename}.id"))
    name: Mapped[str] = mapped_column(index=True)
    abbreviation: Mapped[str]


class Printing(Base):
    __tablename__ = printing_tablename

    id: Mapped[int] = mapped_column(primary_key=True)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    catalog_id: Mapped[int] = mapped_column(ForeignKey(f"{catalog_tablename}.id"))
    name: Mapped[str] = mapped_column(index=True)


class Language(Base):
    __tablename__ = language_tablename

    id: Mapped[int] = mapped_column(primary_key=True)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    catalog_id: Mapped[int] = mapped_column(ForeignKey(f"{catalog_tablename}.id"))
    name: Mapped[str] = mapped_column(index=True)
    abbreviation: Mapped[str]


