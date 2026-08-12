import json

from celery import shared_task
from django.utils import timezone as dj_timezone

from . import redis_cache
from .models import Element


@shared_task
def flush_board_task(board_id):
    """Scheduled 15s after the first change to a clean board (see
    redis_cache.try_acquire_flush_lock). Releases the debounce lock
    immediately so the next change can start a fresh countdown, then
    batches everything dirty for this board into Postgres."""
    redis_cache.release_flush_lock(board_id)

    r = redis_cache.get_client()

    deleted_ids = redis_cache.get_deleted_ids(board_id)
    if deleted_ids:
        Element.objects.filter(id__in=deleted_ids).delete()
        r.delete(redis_cache.deleted_key(board_id))

    cache = redis_cache.get_board_cache(board_id)
    to_create = []
    to_update = []
    now = dj_timezone.now()
    saved_at = redis_cache.now_iso()

    for eid, entry in cache.items():
        if entry.get("saved_at") and entry["saved_at"] >= entry["updated_at"]:
            continue

        if entry.get("persisted"):
            to_update.append(
                Element(
                    id=eid,
                    props=entry["props"],
                    z_index=entry["z_index"],
                    parent_id=entry.get("parent_id"),  # NEW
                    updated_at=now,
                )
            )
        else:
            to_create.append(
                Element(
                    id=eid,
                    board_id=entry["board_id"],
                    parent_id=entry.get("parent_id"),  # NEW
                    type=entry["type"],
                    props=entry["props"],
                    z_index=entry["z_index"],
                    created_by_id=entry.get("created_by_id"),
                )
            )

        entry["saved_at"] = saved_at
        r.hset(redis_cache.elements_key(board_id), eid, json.dumps(entry))

    if to_create:
        Element.objects.bulk_create(to_create, ignore_conflicts=True)
    if to_update:
        Element.objects.bulk_update(to_update, ["props", "z_index", "parent_id", "updated_at"])