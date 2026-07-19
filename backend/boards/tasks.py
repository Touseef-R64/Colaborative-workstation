from celery import shared_task


@shared_task
def export_board_to_pdf(board_id: str) -> str:
    """Placeholder for server-side export.

    For the MVP, prefer exporting directly from Konva on the client
    (stage.toDataURL()) — reach for this only once you need exports
    for very large boards or scheduled/batch jobs.
    """
    # TODO: render board elements headlessly and upload the result,
    # then notify the client (e.g. via the board's WebSocket group).
    return board_id
