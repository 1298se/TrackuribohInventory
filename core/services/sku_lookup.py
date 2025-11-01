import uuid
from typing import Dict, List, NamedTuple, Sequence

from core.models.catalog import SKU


class SKUKey(NamedTuple):
    condition_id: uuid.UUID
    printing_id: uuid.UUID
    language_id: uuid.UUID


class SKUVariantInput(NamedTuple):
    sku_id: uuid.UUID
    condition_id: uuid.UUID
    printing_id: uuid.UUID
    language_id: uuid.UUID


def build_sku_lookup_from_processing_skus(
    skus_in_product: List[SKUVariantInput],
) -> Dict[SKUKey, uuid.UUID]:
    """Build lookup of (condition_id, printing_id, language_id) -> sku_id from variant inputs."""
    sku_lookup: Dict[SKUKey, uuid.UUID] = {}
    for sku in skus_in_product:
        key = SKUKey(
            condition_id=sku.condition_id,
            printing_id=sku.printing_id,
            language_id=sku.language_id,
        )
        sku_lookup[key] = sku.sku_id
    return sku_lookup


def build_sku_tcg_id_lookup_from_skus(skus: Sequence[SKU]) -> Dict[int, SKU]:
    """Build lookup of SKU.tcgplayer_id -> SKU for quick resolution using productConditionId."""
    return {sku.tcgplayer_id: sku for sku in skus if sku.tcgplayer_id is not None}


def build_sku_name_lookup_from_skus(
    skus: Sequence[SKU],
) -> Dict[tuple[str, str, str], SKU]:
    """Build lookup of (condition_name, printing_name, language_name) -> SKU for sales matching."""
    return {
        (sku.condition.name, sku.printing.name, sku.language.name): sku for sku in skus
    }


def build_sku_variant_condition_lookup(
    skus: Sequence[SKU],
) -> Dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], SKU]:
    """Build lookup of (printing_id, language_id, condition_id) -> SKU."""
    return {(sku.printing_id, sku.language_id, sku.condition_id): sku for sku in skus}
