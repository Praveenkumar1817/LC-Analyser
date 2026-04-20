import redis.asyncio as aioredis
from app.core.config import settings
import json
from typing import Any, Optional
import asyncio

class CacheService:
    def __init__(self):
        try:
            self.redis = aioredis.from_url(
                 settings.REDIS_URL, 
                 encoding="utf-8", 
                 decode_responses=True,
                 socket_connect_timeout=0.5,
                 socket_timeout=0.5
            )
        except Exception:
            self.redis = None

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis:
            return None
        try:
            value = await asyncio.wait_for(self.redis.get(key), timeout=0.5)
            if value:
                return json.loads(value)
        except Exception:
            pass
        return None

    async def set(self, key: str, value: Any, expire_seconds: int = 3600):
        if not self.redis:
            return
        try:
            await asyncio.wait_for(self.redis.set(key, json.dumps(value), ex=expire_seconds), timeout=0.5)
        except Exception:
            pass

    async def delete(self, key: str):
        if not self.redis:
            return
        try:
            await asyncio.wait_for(self.redis.delete(key), timeout=0.5)
        except Exception:
            pass

# Global singleton
cache = CacheService()

async def get_cache() -> CacheService:
    return cache
