import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Board, Element
import uuid
# Elements currently locked for editing, per board, kept in-process.
# Fine for a single Channels worker; move to Redis if you scale to multiple workers.
_locks: dict[str, dict[str, str]] = {}


class BoardConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.board_id = self.scope["url_route"]["kwargs"]["board_id"]
        self.group_name = f"board_{self.board_id}"
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            print("here user")
            await self.close(code=4001)
            return

        allowed = await self.user_can_access_board(user, self.board_id)
        if not allowed:
            await self.close(code=4003)
            return

        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Release any locks this connection held.
        board_locks = _locks.get(self.board_id, {})
        released = [eid for eid, holder in board_locks.items() if holder == self.channel_name]
        for eid in released:
            del board_locks[eid]

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            for eid in released:
                await self.channel_layer.group_send(
                    self.group_name,
                    {"type": "broadcast", "payload": {"action": "element.unlock", "id": eid}},
                )

    async def receive_json(self, content, **kwargs):
        action = content.get("action")

        print(action,"here action")

        if action == "element.create":
            element = await self.create_element(content["element"])
            await self.group_broadcast({"action": "element.create", "element": element})

        elif action == "element.update":
            element = await self.update_element(content["id"], content["props"])
            if element:
                await self.group_broadcast({"action": "element.update", "element": element})

        elif action == "element.delete":
            await self.delete_element(content["id"])
            await self.group_broadcast({"action": "element.delete", "id": content["id"]})

        elif action == "element.lock":
            if self.try_lock(content["id"]):
                await self.group_broadcast(
                    {"action": "element.lock", "id": content["id"], "user": self.user.username}
                )

        elif action == "element.unlock":
            self.release_lock(content["id"])
            await self.group_broadcast({"action": "element.unlock", "id": content["id"]})

        elif action == "cursor.move":
            # Cursor position is ephemeral — never persisted, just relayed.
            await self.group_broadcast(
                {
                    "action": "cursor.move",
                    "user": self.user.username,
                    "x": content["x"],
                    "y": content["y"],
                },
                include_self=False,
            )

    async def group_broadcast(self, payload, include_self=True):
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "broadcast", "payload": payload, "sender": None if include_self else self.channel_name},
        )

    async def broadcast(self, event):
        # Channels dispatches on the "type" key ("broadcast" -> this method).
        # Skip echoing back to the sender when the sender opted out (e.g. cursor moves).
        if event.get("sender") == self.channel_name:
            return
        await self.send(text_data=json.dumps(event["payload"]))

    def try_lock(self, element_id):
        board_locks = _locks.setdefault(self.board_id, {})
        holder = board_locks.get(element_id)
        if holder is None or holder == self.channel_name:
            board_locks[element_id] = self.channel_name
            return True
        return False

    def release_lock(self, element_id):
        board_locks = _locks.get(self.board_id, {})
        if board_locks.get(element_id) == self.channel_name:
            del board_locks[element_id]

    @database_sync_to_async
    def user_can_access_board(self, user, board_id):
        return Board.objects.filter(id=board_id, members__user=user).exists()

    @database_sync_to_async
    def create_element(self, data):
        element = Element.objects.create(
            id=data.get("id") or uuid.uuid4(),
            board_id=self.board_id,
            type=data["type"],
            props=data.get("props", {}),
            z_index=data.get("z_index", 0),
            created_by=self.user,
        )
        return {
            "id": str(element.id),
            "type": element.type,
            "props": element.props,
            "z_index": element.z_index,
        }
    @database_sync_to_async
    def update_element(self, element_id, props):
        updated = Element.objects.filter(id=element_id, board_id=self.board_id).update(
            props=props
        )
        if not updated:
            return None
        return {"id": element_id, "props": props}

    @database_sync_to_async
    def delete_element(self, element_id):
        Element.objects.filter(id=element_id, board_id=self.board_id).delete()
