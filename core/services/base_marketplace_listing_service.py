"""Abstract base class for marketplace listing services with shared caching logic."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, TypeVar, Generic

import redis.asyncio as redis
from pydantic import BaseModel

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60 * 60
CACHE_VERSION = "v1"  # Increment when DTO schemas change to invalidate cache
"""
To invalidate cache when DTOs change:
1. Increment CACHE_VERSION (e.g., "v1" -> "v2")
2. Deploy the change - old cache keys become unreachable
3. Optionally call invalidate_cache_version("v1") to clean up old keys
"""

T = TypeVar("T", bound=BaseModel)


class BaseMarketplaceListingService(ABC, Generic[T]):
    """Base class for marketplace listing services with Redis caching."""

    def __init__(self, redis_client: redis.Redis) -> None:
        self.redis = redis_client

    @property
    @abstractmethod
    def marketplace_name(self) -> str:
        """Return the marketplace identifier for cache keys (e.g., 'tcgplayer', 'ebay')."""
        pass

    def _get_cache_key(self, cache_type: str, product_id: str | int) -> str:
        """Generate versioned Redis cache key for DTO cache invalidation."""
        return f"{CACHE_VERSION}:{self.marketplace_name}:{cache_type}:{product_id}"

    async def _get_from_cache(
        self, cache_key: str, data_class: type[T]
    ) -> Optional[List[T]]:
        """Get data from Redis cache and deserialize."""
        try:
            cached_data = await self.redis.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                return [data_class.model_validate(item) for item in data]
        except Exception as e:
            logger.warning("Cache retrieval error for key %s: %s", cache_key, e)
        return None

    async def _set_cache(self, cache_key: str, data: List[T]) -> None:
        """Serialize and store data in Redis cache."""
        try:
            serializable_data = [item.model_dump(mode="json") for item in data]
            await self.redis.setex(
                cache_key, CACHE_TTL_SECONDS, json.dumps(serializable_data)
            )
        except Exception as e:
            logger.warning("Cache storage error for key %s: %s", cache_key, e)

    async def invalidate_cache_version(self, version: str | None = None) -> int:
        """Invalidate all cache keys for a specific version."""

        target_version = version or CACHE_VERSION
        pattern = f"{target_version}:{self.marketplace_name}:*"

        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                deleted_count = await self.redis.delete(*keys)
                logger.info(
                    "Invalidated %d cache keys for %s version %s",
                    deleted_count,
                    self.marketplace_name,
                    target_version,
                )
                return deleted_count

            logger.info(
                "No cache keys found for %s version %s",
                self.marketplace_name,
                target_version,
            )
            return 0

        except Exception as e:
            logger.error(
                "Cache invalidation error for %s version %s: %s",
                self.marketplace_name,
                target_version,
                e,
            )
            return 0
