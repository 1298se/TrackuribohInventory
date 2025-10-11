"""
Rarity constants for Pokemon TCG products.
Lower numbers = more rare/harder to pull
Higher numbers = more common/easier to pull
"""

RARITY_PULL_RATES = {
    # Ultra Rare & Hyper Rare (1-10)
    "10000 Secret Rare": 1,
    "Illustration Rare": 2,
    "Special Illustration Rare": 2,
    "Hyper Rare": 3,
    "Mega Hyper Rare": 3,
    "Special Art Rare": 4,
    "Secret Rare": 5,
    "Shiny Secret Rare": 5,
    "Ultra Rare": 6,
    "Mega Ultra Rare": 6,
    "Shiny Ultra Rare": 7,
    "ACE SPEC Rare": 8,
    "ACE Rare": 9,
    "Art Rare": 10,

    # Very Rare (11-20)
    "Amazing Rare": 11,
    "Character Super Rare": 12,
    "Character Rare": 13,
    "Radiant Rare": 14,
    "Shining": 15,
    "Shiny Holo Rare": 16,
    "Trainer Rare": 17,
    "Rare Holo LEGEND": 18,
    "Rare Holo LV.X": 19,
    "Prism Rare": 20,

    # Rare (21-40)
    "Triple Rare": 21,
    "Double Rare": 22,
    "Rare BREAK": 23,
    "Shiny Rare": 24,
    "Kagayaku": 25,
    "Rare Ace": 26,
    "Holo Rare": 30,
    "Super Rare Holo": 31,
    "Black White Rare": 32,
    "Rare": 35,

    # Uncommon/Common (41-60)
    "Common Holo": 41,
    "Uncommon": 50,
    "Common": 60,

    # Promos & Special (70-80)
    "Promo": 70,
    "Classic Collection": 71,
    "Code Card": 75,

    # Yu-Gi-Oh! Rarities (1-60)
    "Starlight Rare": 1,
    "Quarter Century Secret Rare": 2,
    "Ghost Rare": 3,
    "Prismatic Secret Rare": 4,
    "Ultimate Rare": 5,
    "Prismatic Ultimate Rare": 5,
    "Secret Pharaoh's Rare": 6,
    "Ultra Pharaoh's Rare": 7,
    "Prismatic Collector's Rare": 8,
    "Collector's Rare": 9,
    "Ghost/Gold Rare": 10,
    "Platinum Secret Rare": 11,
    "Gold Secret Rare": 12,
    "Emblazoned Secret Rare": 13,
    "Emblazoned Ultra Rare": 14,
    "Platinum Rare": 15,
    "Gold Rare": 16,
    "Premium Gold Rare": 17,
    "Shatterfoil Rare": 20,
    "Starfoil Rare": 21,
    "Mosaic Rare": 22,
    "Parallel Rare": 23,
    "Duel Terminal Ultra Parallel Rare": 24,
    "Duel Terminal Super Parallel Rare": 25,
    "Duel Terminal Rare Parallel Rare": 26,
    "Duel Terminal Normal Parallel Rare": 27,
    "Duel Terminal Technology Ultra Rare": 28,
    "Duel Terminal Technology Common": 29,
    "Super Rare": 40,
    "Ultra-Rare Common": 41,
    "Ultra-Rare Uncommon": 42,

    # Unknown/Default (90+)
    "None": 90,
    "Unconfirmed": 95,
}

def get_rarity_sort_key(rarity: str | None) -> int:
    """
    Get the sort key for a rarity.
    Returns the pull rate number, with unknown rarities sorted last.
    """
    if rarity is None:
        return 100
    return RARITY_PULL_RATES.get(rarity, 99)
