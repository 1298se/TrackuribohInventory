from datetime import datetime
from enum import unique, Enum
from typing import List, Any

from sqlalchemy import Integer, String, ForeignKey, Text, inspect, JSON
from sqlalchemy.orm import relationship, mapped_column, DeclarativeBase, Mapped
from typing_extensions import Optional

catalog_tablename = "catalog"
set_tablename = "set"
product_tablename = "product"
sku_tablename = "sku"
condition_tablename = "condition"
printing_tablename = "printing"
language_tablename = "language"

class Base(DeclarativeBase):
    type_annotation_map = {
        dict[str, Any]: JSON
    }

    pass

"""
    The franchise, such as Pokemon or YuGiOh
"""
class Catalog(Base):
    __tablename__ = catalog_tablename

    id: Mapped[int] = mapped_column(primary_key=True)
    # Maps to a TCGPlayer "Category"
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    modified_date: Mapped[datetime] = mapped_column()
    display_name: Mapped[str] = mapped_column()


class Set(Base):
    __tablename__ = set_tablename

    id: Mapped[int] = mapped_column(primary_key=True)
    # Maps to a TCGPlayer "Group"
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    name: Mapped[str] = mapped_column(String(), index=True)
    code: Mapped[str] = mapped_column(String())
    release_date: Mapped[datetime] = mapped_column()
    modified_date: Mapped[datetime] = mapped_column()
    catalog_id: Mapped[int] = mapped_column(ForeignKey(f"{catalog_tablename}.id"))
    catalog: Mapped["Catalog"] = relationship()
    products: Mapped[list["Product"]] = relationship(back_populates="set")

class Product(Base):
    __tablename__ = product_tablename

    id: Mapped[int] = mapped_column(primary_key=True)
    tcgplayer_id: Mapped[int] = mapped_column(unique=True)
    # Blue-Eyes White Dragon
    name: Mapped[str] = mapped_column(index=True)
    # name but without hyphens, semicolons, etc
    clean_name: Mapped[str] = mapped_column(index=True)
    image_url: Mapped[Optional[str]] = mapped_column()
    set_id: Mapped[int] = mapped_column(ForeignKey(f"{set_tablename}.id"))
    set: Mapped["Set"] = relationship(back_populates="products")
    skus: Mapped[List["SKU"]] = relationship(back_populates="product")
    product_type: Mapped[str] = mapped_column()
    data: Mapped[dict[str, Any]] = mapped_column()



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
    abbreviation: Mapped[str] = mapped_column()


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
    abbreviation: Mapped[str] = mapped_column()


