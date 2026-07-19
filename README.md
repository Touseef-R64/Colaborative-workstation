# Miro Lite — starter scaffold

A working skeleton for a collaborative whiteboard: Next.js + Konva
frontend, Django + Channels + DRF + Celery backend, Postgres + Redis, all
containerized with Docker Compose.

This is a **working starting point**, not a finished product — but the core
loop is real now: sign up, log in, create/invite to boards, and draw
together in real time with sticky notes, shapes, text, and freehand
strokes, with undo/redo and multi-select. Export and production deploy
configs are still open work — see "What's stubbed" below.

## Run it

```bash
docker compose up --build
```

This starts:
- `db` — Postgres on 5432
- `redis` — Redis on 6379 (Channels layer + Celery broker)
- `backend` — Django/Daphne on http://localhost:8000
- `celery` — Celery worker (no scheduled jobs yet, just wired up)
- `frontend` — Next.js dev server on http://localhost:3000

Prefer running natively instead of Docker for faster iteration? See
`scripts\data.bat` and the native-run notes further down.

## First-time backend setup

In a second terminal, once containers are up:

```bash
docker compose exec backend python manage.py migrate
```

That's it — **no `createsuperuser` step needed anymore.** Auth is real now:
open http://localhost:3000, use the **Sign up** tab to create an account,
and you're in. The old workaround (log into `/admin` to get a session
cookie, since there was no login page) is gone; JWT access/refresh tokens
are issued on login/register and stored client-side, with a background
scheduler that refreshes the access token shortly before it expires and
redirects to `/` if the refresh also fails.

Boards are created and invited to from the UI now too — no more manually
creating a `Board` in `/admin` and copying its UUID. From the boards
dashboard, create a board, open it, and use the invite icon (top-right of
the canvas) to search for and add other users by username.

## What's wired up end-to-end

- **Auth** — register/login/logout via JWT (`djangorestframework-simplejwt`),
  proactive token refresh before expiry, redirect to login on refresh failure
- **Boards** — create, list, rename, delete; invite/remove members by
  username search (owner-only for now), `GET/POST /api/boards/<id>/members/`
- REST CRUD for boards and elements (`/api/boards/`, `/api/elements/`)
- WebSocket consumer at `ws://localhost:8000/ws/boards/<id>/` handling
  create/update/delete, per-element locking, and cursor broadcast
- Zustand store synced from both the initial REST fetch and live WS events
- **Canvas tools** — Select (click, marquee-select multiple, group-drag),
  Sticky notes, Rectangles, Freehand pen, Text — all render via Konva and
  sync live over the WebSocket
- **Inline editing** — double-click a sticky note or text element to edit
  its text in place
- **Undo/redo** — Ctrl+Z / Ctrl+Shift+Z (or toolbar buttons), covers
  create, delete, move, and text edits uniformly via before/after snapshots
- **Delete** — Delete/Backspace key or toolbar button, respects other
  users' active locks
- Infinite pan (hold Space + drag) and zoom (scroll wheel)

## What's stubbed / next steps

- Per-board **roles** beyond who's a member — `viewer` exists on the model
  but isn't enforced anywhere yet; viewers can currently edit like editors
- Invite is immediate add-by-username, not a real invitation with
  accept/decline, and there's no notification to the invited user
- Image upload (element type exists on the model, no UI yet)
- Export to PNG/PDF (Celery task in `boards/tasks.py` is a placeholder)
- Freehand strokes can be selected but not dragged/moved yet, individually
  or as part of a group-select
- Undo/redo is local to your own session — it doesn't undo other users'
  actions, and can conflict with concurrent edits from others (same
  last-write-wins model as the rest of the app)
- Production Dockerfiles (current ones are dev-mode with hot reload;
  `frontend/Dockerfile` needs a `next build` + `next start` variant, and
  `backend` needs `collectstatic` + a non-dev `ALLOWED_HOSTS`/`DEBUG=0`)