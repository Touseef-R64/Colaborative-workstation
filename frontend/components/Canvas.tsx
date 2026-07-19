"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import type Konva from "konva";
import { v4 as uuidv4 } from "uuid";
import { useQuery } from "@tanstack/react-query";
import { fetchElements, ElementDTO } from "@/lib/api";
import { useBoardStore } from "@/lib/store";
import { useBoardSocket } from "@/lib/useBoardSocket";
import { useCurrentUser } from "@/lib/useAuth";

const STICKY_COLOR = "#FEF3C7";
const STICKY_SIZE = 160;
const RECT_COLOR = "#BFDBFE";
const STROKE_COLOR = "#1F2937";
const SELECT_COLOR = "#2563EB";

type Tool = "select" | "sticky" | "rectangle" | "pen" | "text";
type Box = { x: number; y: number; width: number; height: number };
type Props = Record<string, unknown>;

interface Snapshot {
  type: ElementDTO["type"];
  props: Props;
  z_index: number;
}
interface UndoEntry {
  moves: { id: string; before: Snapshot | null; after: Snapshot | null }[];
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "sticky", label: "Sticky" },
  { id: "rectangle", label: "Rectangle" },
  { id: "pen", label: "Pen" },
  { id: "text", label: "Text" },
];

let lastCursorSent = 0;

function elementBounds(el: ElementDTO): Box {
  const props = el.props as Record<string, number | number[] | string>;
  const x = (props.x as number) ?? 0;
  const y = (props.y as number) ?? 0;

  if (el.type === "sticky") return { x, y, width: STICKY_SIZE, height: STICKY_SIZE };
  if (el.type === "shape") {
    return { x, y, width: (props.width as number) ?? 100, height: (props.height as number) ?? 100 };
  }
  if (el.type === "text") {
    const text = (props.text as string) ?? "";
    return { x, y, width: Math.max(40, text.length * 10), height: 24 };
  }
  if (el.type === "stroke") {
    const points = (props.points as number[]) ?? [];
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, 0);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 0);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x, y, width: 0, height: 0 };
}

function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export default function Canvas({ boardId }: { boardId: string }) {
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("select");
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  const [draftRect, setDraftRect] = useState<Box | null>(null);
  const [draftStroke, setDraftStroke] = useState<number[] | null>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<Box | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const dragAnchorId = useRef<string | null>(null);
  const groupDragStart = useRef<Record<string, { x: number; y: number }>>({});
  const [groupOffset, setGroupOffset] = useState<{ dx: number; dy: number } | null>(null);

  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const elements = useBoardStore((s) => s.elements);
  const lockedBy = useBoardStore((s) => s.lockedBy);
  const setElements = useBoardStore((s) => s.setElements);
  const { send } = useBoardSocket(boardId);
  const { data: currentUser } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ["elements", boardId],
    queryFn: () => fetchElements(boardId),
  });

  useEffect(() => {
    if (data) setElements(data);
  }, [data, setElements]);

  const pushUndo = (entry: UndoEntry) => {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  };

  const applySnapshot = (id: string, snap: Snapshot | null) => {
    if (!snap) {
      send({ action: "element.delete", id });
    } else if (elements[id]) {
      send({ action: "element.update", id, props: snap.props });
    } else {
      send({ action: "element.create", element: { id, type: snap.type, props: snap.props, z_index: snap.z_index } });
    }
  };

  const undo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      entry.moves.forEach((m) => applySnapshot(m.id, m.before));
      setRedoStack((r) => [...r, entry]);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      entry.moves.forEach((m) => applySnapshot(m.id, m.after));
      setUndoStack((u) => [...u, entry]);
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceDown(true);

      const typing =
        document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        deleteSelected();
      }
      if (e.key === "Escape") setSelectedIds(new Set());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, lockedBy, currentUser, elements]);

  const deleteSelected = () => {
    const moves: UndoEntry["moves"] = [];
    selectedIds.forEach((id) => {
      const heldBy = lockedBy[id];
      const el = elements[id];
      if (el && (!heldBy || heldBy === currentUser?.username)) {
        moves.push({ id, before: { type: el.type, props: el.props, z_index: el.z_index }, after: null });
        send({ action: "element.delete", id });
      }
    });
    if (moves.length > 0) pushUndo({ moves });
    setSelectedIds(new Set());
  };

  const getDataPoint = () => stageRef.current?.getRelativePointerPosition() ?? null;

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * 1.05 : oldScale / 1.05;
    const clamped = Math.min(Math.max(newScale, 0.1), 5);

    setScale(clamped);
    setStagePos({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  };

  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  };

  const clickedOnEmpty = (e: Konva.KonvaEventObject<MouseEvent>) =>
    e.target === e.target.getStage();

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const point = getDataPoint();
    if (!point) return;

    if (tool === "sticky") {
      const id = uuidv4();
      const props = { x: point.x - STICKY_SIZE / 2, y: point.y - STICKY_SIZE / 2, text: "New note" };
      const z_index = Object.keys(elements).length;
      send({ action: "element.create", element: { id, type: "sticky", props, z_index } });
      pushUndo({ moves: [{ id, before: null, after: { type: "sticky", props, z_index } }] });
      return;
    }

    if (tool === "text") {
      const id = uuidv4();
      const props = { x: point.x, y: point.y, text: "Text" };
      const z_index = Object.keys(elements).length;
      send({ action: "element.create", element: { id, type: "text", props, z_index } });
      pushUndo({ moves: [{ id, before: null, after: { type: "text", props, z_index } }] });
      return;
    }

    if (tool === "rectangle") {
      drawStart.current = point;
      setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }

    if (tool === "pen") {
      setDraftStroke([point.x, point.y]);
      return;
    }

    if (tool === "select" && !isSpaceDown && clickedOnEmpty(e)) {
      marqueeStart.current = point;
      setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
    }
  };

  const handleStageMouseMove = () => {
    const now = Date.now();
    if (now - lastCursorSent >= 80) {
      lastCursorSent = now;
      const pointer = stageRef.current?.getPointerPosition();
      if (pointer) send({ action: "cursor.move", x: pointer.x, y: pointer.y });
    }

    if (tool === "rectangle" && drawStart.current) {
      const point = getDataPoint();
      if (!point) return;
      const start = drawStart.current;
      setDraftRect({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      });
    }

    if (tool === "pen" && draftStroke) {
      const point = getDataPoint();
      if (!point) return;
      setDraftStroke((prev) => (prev ? [...prev, point.x, point.y] : prev));
    }

    if (marqueeStart.current) {
      const point = getDataPoint();
      if (!point) return;
      const start = marqueeStart.current;
      setMarquee({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      });
    }
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "rectangle" && draftRect) {
      if (draftRect.width > 2 && draftRect.height > 2) {
        const id = uuidv4();
        const props = { ...draftRect, fill: RECT_COLOR };
        const z_index = Object.keys(elements).length;
        send({ action: "element.create", element: { id, type: "shape", props, z_index } });
        pushUndo({ moves: [{ id, before: null, after: { type: "shape", props, z_index } }] });
      }
      setDraftRect(null);
      drawStart.current = null;
    }

    if (tool === "pen" && draftStroke) {
      if (draftStroke.length > 2) {
        const id = uuidv4();
        const props = { points: draftStroke, stroke: STROKE_COLOR, strokeWidth: 3 };
        const z_index = Object.keys(elements).length;
        send({ action: "element.create", element: { id, type: "stroke", props, z_index } });
        pushUndo({ moves: [{ id, before: null, after: { type: "stroke", props, z_index } }] });
      }
      setDraftStroke(null);
    }

    if (marqueeStart.current) {
      if (marquee && (marquee.width > 3 || marquee.height > 3)) {
        const hits = Object.values(elements).filter((el) => boxesIntersect(marquee, elementBounds(el)));
        setSelectedIds(new Set(hits.map((el) => el.id)));
      } else if (clickedOnEmpty(e)) {
        setSelectedIds(new Set());
      }
      marqueeStart.current = null;
      setMarquee(null);
    }
  };

  const selectElement = (id: string) => {
    setSelectedIds((prev) => (prev.has(id) && prev.size > 1 ? prev : new Set([id])));
  };

  const startEditing = (el: ElementDTO) => {
    const text = (el.props as { text?: string }).text ?? "";
    setEditingId(el.id);
    setEditingText(text);
    setSelectedIds(new Set([el.id]));
  };

  const commitEdit = () => {
    if (!editingId) return;
    const el = elements[editingId];
    if (el) {
      const before = { type: el.type, props: el.props, z_index: el.z_index };
      const newProps = { ...el.props, text: editingText };
      send({ action: "element.update", id: editingId, props: newProps });
      pushUndo({
        moves: [{ id: editingId, before, after: { type: el.type, props: newProps, z_index: el.z_index } }],
      });
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const isGroupDrag = (id: string) => selectedIds.size > 1 && selectedIds.has(id);

  const handleDragStart = (id: string, x: number, y: number) => {
    if (isGroupDrag(id)) {
      dragAnchorId.current = id;
      groupDragStart.current = {};
      selectedIds.forEach((sid) => {
        const el = elements[sid];
        if (!el) return;
        const p = el.props as { x?: number; y?: number };
        groupDragStart.current[sid] = { x: p.x ?? 0, y: p.y ?? 0 };
        send({ action: "element.lock", id: sid });
      });
    } else {
      send({ action: "element.lock", id });
    }
  };

  const handleDragMove = (id: string, node: Konva.Node) => {
    if (dragAnchorId.current === id) {
      const start = groupDragStart.current[id];
      if (!start) return;
      setGroupOffset({ dx: node.x() - start.x, dy: node.y() - start.y });
    }
  };

  const handleDragEnd = (id: string, x: number, y: number) => {
    if (dragAnchorId.current === id) {
      const { dx, dy } = groupOffset ?? { dx: 0, dy: 0 };
      const moves: UndoEntry["moves"] = [];
      Object.entries(groupDragStart.current).forEach(([sid, start]) => {
        const el = elements[sid];
        if (!el) return;
        const before = { type: el.type, props: el.props, z_index: el.z_index };
        const newProps = { ...el.props, x: start.x + dx, y: start.y + dy };
        send({ action: "element.update", id: sid, props: newProps });
        send({ action: "element.unlock", id: sid });
        moves.push({ id: sid, before, after: { type: el.type, props: newProps, z_index: el.z_index } });
      });
      if (moves.length > 0) pushUndo({ moves });
      dragAnchorId.current = null;
      groupDragStart.current = {};
      setGroupOffset(null);
      return;
    }

    const el = elements[id];
    if (el) {
      const before = { type: el.type, props: el.props, z_index: el.z_index };
      const newProps = { ...el.props, x, y };
      send({ action: "element.update", id, props: newProps });
      pushUndo({ moves: [{ id, before, after: { type: el.type, props: newProps, z_index: el.z_index } }] });
    }
    send({ action: "element.unlock", id });
  };

  const renderPos = (el: ElementDTO): { x: number; y: number } => {
    const p = el.props as { x?: number; y?: number };
    const base = { x: p.x ?? 0, y: p.y ?? 0 };
    if (groupOffset && isGroupDrag(el.id)) {
      const start = groupDragStart.current[el.id] ?? base;
      return { x: start.x + groupOffset.dx, y: start.y + groupOffset.dy };
    }
    return base;
  };

  const toScreen = (x: number, y: number) => ({
    x: x * scale + stagePos.x,
    y: y * scale + stagePos.y,
  });

  const editingEl = editingId ? elements[editingId] : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-50">
      <div className="absolute left-4 top-4 z-10 flex gap-1 rounded-lg bg-white p-1 shadow">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTool(t.id);
              setSelectedIds(new Set());
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              tool === t.id ? "bg-amber-400" : "hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="mx-1 w-px bg-gray-200" />
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          onClick={deleteSelected}
          disabled={selectedIds.size === 0}
          className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-30"
          title="Delete (Del)"
        >
          Delete
        </button>
      </div>

      {tool === "select" && (
        <div className="absolute left-4 top-16 z-10 text-xs text-gray-500">
          Hold Space + drag to pan · Drag on empty canvas to select multiple · Double-click text to edit
        </div>
      )}

      <Stage
        ref={stageRef}
        width={typeof window !== "undefined" ? window.innerWidth : 0}
        height={typeof window !== "undefined" ? window.innerHeight : 0}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={tool === "select" && isSpaceDown}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer>
          {Object.values(elements).map((el) => {
            const heldBy = lockedBy[el.id];
            const lockedByOther = !!heldBy && heldBy !== currentUser?.username;
            const selected = selectedIds.has(el.id);
            const canDrag = tool === "select" && !lockedByOther && !isSpaceDown;
            const strokeColor = lockedByOther ? "#D97706" : selected ? SELECT_COLOR : undefined;
            const strokeW = lockedByOther || selected ? 2 : 0;
            const isEditingThis = editingId === el.id;
            const pos = renderPos(el);

            if (el.type === "sticky") {
              const { text = "" } = el.props as { text: string };
              return (
                <Group key={el.id}>
                  <Rect
                    x={pos.x}
                    y={pos.y}
                    width={STICKY_SIZE}
                    height={STICKY_SIZE}
                    fill={STICKY_COLOR}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    shadowBlur={4}
                    cornerRadius={6}
                    draggable={canDrag}
                    onMouseDown={() => selectElement(el.id)}
                    onDblClick={() => startEditing(el)}
                    onDragStart={(e) => handleDragStart(el.id, e.target.x(), e.target.y())}
                    onDragMove={(e) => handleDragMove(el.id, e.target)}
                    onDragEnd={(e) => handleDragEnd(el.id, e.target.x(), e.target.y())}
                  />
                  {!isEditingThis && (
                    <Text
                      x={pos.x + 12}
                      y={pos.y + 12}
                      width={STICKY_SIZE - 24}
                      text={text}
                      fontSize={14}
                      listening={false}
                    />
                  )}
                </Group>
              );
            }

            if (el.type === "shape") {
              const { width = 100, height = 100, fill = RECT_COLOR } = el.props as {
                width: number;
                height: number;
                fill: string;
              };
              return (
                <Rect
                  key={el.id}
                  x={pos.x}
                  y={pos.y}
                  width={width}
                  height={height}
                  fill={fill}
                  stroke={strokeColor ?? "#1F2937"}
                  strokeWidth={strokeW || 1}
                  draggable={canDrag}
                  onMouseDown={() => selectElement(el.id)}
                  onDragStart={(e) => handleDragStart(el.id, e.target.x(), e.target.y())}
                  onDragMove={(e) => handleDragMove(el.id, e.target)}
                  onDragEnd={(e) => handleDragEnd(el.id, e.target.x(), e.target.y())}
                />
              );
            }

            if (el.type === "text") {
              const { text = "" } = el.props as { text: string };
              if (isEditingThis) return null;
              return (
                <Text
                  key={el.id}
                  x={pos.x}
                  y={pos.y}
                  text={text}
                  fontSize={18}
                  fill={lockedByOther ? "#D97706" : selected ? SELECT_COLOR : "#111827"}
                  draggable={canDrag}
                  onMouseDown={() => selectElement(el.id)}
                  onDblClick={() => startEditing(el)}
                  onDragStart={(e) => handleDragStart(el.id, e.target.x(), e.target.y())}
                  onDragMove={(e) => handleDragMove(el.id, e.target)}
                  onDragEnd={(e) => handleDragEnd(el.id, e.target.x(), e.target.y())}
                />
              );
            }

            if (el.type === "stroke") {
              const { points = [], stroke = STROKE_COLOR, strokeWidth = 3 } = el.props as {
                points: number[];
                stroke: string;
                strokeWidth: number;
              };
              return (
                <Line
                  key={el.id}
                  points={points}
                  stroke={selected ? SELECT_COLOR : stroke}
                  strokeWidth={strokeWidth}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.4}
                  onMouseDown={() => selectElement(el.id)}
                />
              );
            }

            return null;
          })}

          {draftRect && (
            <Rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.width}
              height={draftRect.height}
              fill={RECT_COLOR}
              opacity={0.5}
              stroke="#1F2937"
              dash={[4, 4]}
              listening={false}
            />
          )}

          {draftStroke && (
            <Line
              points={draftStroke}
              stroke={STROKE_COLOR}
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              tension={0.4}
              listening={false}
            />
          )}

          {marquee && (
            <Rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill={SELECT_COLOR}
              opacity={0.1}
              stroke={SELECT_COLOR}
              dash={[4, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {editingEl &&
        (() => {
          const props = editingEl.props as { x: number; y: number };
          const isSticky = editingEl.type === "sticky";
          const screen = toScreen(props.x + (isSticky ? 12 : 0), props.y + (isSticky ? 12 : 0));
          const width = (isSticky ? STICKY_SIZE - 24 : 200) * scale;

          return (
            <textarea
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") cancelEdit();
              }}
              style={{
                position: "absolute",
                left: screen.x,
                top: screen.y,
                width,
                fontSize: (isSticky ? 14 : 18) * scale,
                border: "1px solid #2563EB",
                background: "white",
                padding: 2,
                resize: "none",
                outline: "none",
                lineHeight: 1.3,
                zIndex: 20,
              }}
            />
          );
        })()}
    </div>
  );
}