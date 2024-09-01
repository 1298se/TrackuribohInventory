from datetime import datetime
from typing import List

from sqlalchemy import Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship, mapped_column, DeclarativeBase, Mapped
from typing_extensions import Optional


class Base(DeclarativeBase):
    pass

class Set(Base):
    __tablename__ = "set"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(), index=True)
    code: Mapped[str] = mapped_column(String())
    release_date: Mapped[datetime] = mapped_column()
    modified_date: Mapped[datetime] = mapped_column()
    cards: Mapped[list["Card"]] = relationship(back_populates="set")

class Card(Base):
    __tablename__ = "card"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Blue-Eyes White Dragon
    name: Mapped[str] = mapped_column(index=True)
    # name but without hyphens, semicolons, etc
    clean_name: Mapped[str] = mapped_column(index=True)
    image_url: Mapped[Optional[str]] = mapped_column()
    set_id: Mapped[int] = mapped_column(ForeignKey("set.id"))
    set: Mapped["Set"] = relationship(back_populates="cards")
    number: Mapped[str] = mapped_column(String(16), index=True)
    # Ultra rare
    # For some reason, the catalog endpoint for fetching rarities doesn't give us all possible card rarities...
    rarity_name: Mapped[str] = mapped_column(index=True)
    # LIGHT
    attribute: Mapped[str] = mapped_column()
    # Normal Monster
    card_type: Mapped[str] = mapped_column()
    # Dragon
    monster_type: Mapped[str] = mapped_column()
    attack: Mapped[str] = mapped_column()
    defense: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column(Text)
    skus: Mapped[List["SKU"]] = relationship(back_populates="card")


class SKU(Base):
    __tablename__ = "sku"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey('card.id'))
    card: Mapped["Card"] = relationship(back_populates="skus")
    printing_id: Mapped[int] = mapped_column(ForeignKey('printing.id'))
    printing: Mapped["Printing"] = relationship()
    condition_id: Mapped[int] = mapped_column(ForeignKey('condition.id'))
    condition: Mapped["Condition"] = relationship()


class Condition(Base):
    __tablename__ = "condition"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True, index=True)
    abbreviation: Mapped[str] = mapped_column()
    order: Mapped[int] = mapped_column()


class Printing(Base):
    __tablename__ = "printing"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True, index=True)
    order: Mapped[int] = mapped_column()

