import logging
from typing import AsyncGenerator

import redis.asyncio as redis

from core.environment import get_environment

logger = logging.getLogger(__name__)

_redis_pool: redis.ConnectionPool | None = None


def get_redis_pool() -> redis.ConnectionPool:
    """Get or create Redis connection pool using default settings."""
    global _redis_pool
    if _redis_pool is None:
        env = get_environment()
        _redis_pool = redis.ConnectionPool.from_url(
            env.redis_url,
        )
        logger.info("Redis connection pool initialized")
    return _redis_pool


async def get_redis_client() -> AsyncGenerator[redis.Redis, None]:
    """FastAPI dependency to get Redis client."""
    pool = get_redis_pool()
    client = redis.Redis(connection_pool=pool)
    try:
        yield client
    except Exception as e:
        logger.error(f"Redis client error: {e}")
        raise


async def create_redis_client() -> redis.Redis:
    """Create Redis client for manual usage (background jobs, etc.)."""
    pool = get_redis_pool()
    return redis.Redis(connection_pool=pool)


async def close_redis_pool() -> None:
    """Close Redis connection pool on app shutdown."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None
        logger.info("Redis connection pool closed")
