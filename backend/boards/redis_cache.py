"""Element write-cache backed by Redis.

The WebSocket consumer writes here on every create/update/delete instead of
hitting Postgres directly. Rather than a periodic scan, each board schedules
its own flush: the first change after a board goes "clean" acquires a
15-second debounce lock and schedules a Celery task for +15s; every change
that arrives while that lock is held just updates the cache and does NOT
schedule another task, since one's already coming. See tasks.py.

Redis layout, per board:
    board:{id}:elements     HASH   element_id -> JSON blob (see cache_create)
    board:{id}:deleted      SET    element_ids deleted since the last flush
    flush_scheduled:{id}    STRING debounce lock, SET NX EX 15
"""
import json
from datetime import datetime, timezone as dt_timezone

import redis
from django.conf import settings

FLUSH_DELAY_SECONDS = 15

_client = None


def get_client():
    global _client
    if _client is None:
        _client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


def elements_key(board_id):
    return f"board:{board_id}:elements"


def deleted_key(board_id):
    return f"board:{board_id}:deleted"


def flush_lock_key(board_id):
    return f"flush_scheduled:{board_id}"


def now_iso():
    return datetime.now(dt_timezone.utc).isoformat()


def try_acquire_flush_lock(board_id):
    """True if the caller should schedule a flush (nothing pending yet for
    this board); False if one's already scheduled and will pick this up.
    Atomic via Redis SET NX — safe even with multiple Channels workers."""
    r = get_client()
    return bool(r.set(flush_lock_key(board_id), "1", nx=True, ex=FLUSH_DELAY_SECONDS))


def release_flush_lock(board_id):
    r = get_client()
    r.delete(flush_lock_key(board_id))


def cache_create(board_id, element_id, type_, props, z_index, created_by_id):
    r = get_client()
    entry = {
        "id": str(element_id),
        "board_id": str(board_id),
        "type": type_,
        "props": props,
        "z_index": z_index,
        "created_by_id": created_by_id,
        "updated_at": now_iso(),
        "saved_at": None,
        "persisted": False,
    }
    r.hset(elements_key(board_id), str(element_id), json.dumps(entry))
    return entry


def cache_update(board_id, element_id, props):
    r = get_client()
    key = elements_key(board_id)
    raw = r.hget(key, str(element_id))

    if raw:
        entry = json.loads(raw)
        entry["props"] = props
    else:
        from .models import Element
        try:
            el = Element.objects.get(id=element_id, board_id=board_id)
        except Element.DoesNotExist:
            return None
        entry = {
            "id": str(element_id),
            "board_id": str(board_id),
            "type": el.type,
            "props": props,
            "z_index": el.z_index,
            "created_by_id": el.created_by_id,
            "saved_at": now_iso(),
            "persisted": True,
        }

    entry["updated_at"] = now_iso()
    r.hset(key, str(element_id), json.dumps(entry))
    return entry


def cache_delete(board_id, element_id):
    r = get_client()
    r.hdel(elements_key(board_id), str(element_id))
    r.sadd(deleted_key(board_id), str(element_id))


def get_board_cache(board_id):
    r = get_client()
    raw = r.hgetall(elements_key(board_id))
    return {eid: json.loads(val) for eid, val in raw.items()}


def get_deleted_ids(board_id):
    r = get_client()
    return r.smembers(deleted_key(board_id))