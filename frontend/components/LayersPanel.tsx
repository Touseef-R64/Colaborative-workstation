"use client";

import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import {
  ElementDTO, SavedTemplateDTO, fetchTemplates, saveGroupAsTemplate, applyTemplate, deleteTemplate,
} from "@/lib/api";
import { zIndexBetween } from "@/lib/zIndex";
import type { OutgoingMessage } from "@/lib/useBoardSocket";

interface Props {
  boardId: string;
  elements: Record<string, ElementDTO>;
  lockedBy: Record<string, string>;
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  send: (msg: OutgoingMessage) => void;
  currentUsername?: string;
}

const TYPE_LABEL: Record<string, string> = {
  sticky: "S", shape: "R", text: "T", stroke: "P", frame: "F", group: "G", image: "I",
};

interface Row {
  el: ElementDTO;
  depth: number;
  hasChildren: boolean;
}

function buildRows(
  elements: Record<string, ElementDTO>,
  parentId: string | null,
  depth: number,
  expanded: Set<string>,
  out: Row[]
) {
  const siblings = Object.values(elements)
    .filter((e) => (e.parent ?? null) === parentId)
    .sort((a, b) => b.z_index - a.z_index); // topmost layer first, Figma-style

  for (const el of siblings) {
    const children = Object.values(elements).filter((e) => e.parent === el.id);
    out.push({ el, depth, hasChildren: children.length > 0 });
    if ((el.type === "frame" || el.type === "group") && expanded.has(el.id)) {
      buildRows(elements, el.id, depth + 1, expanded, out);
    }
  }
}

function rowLabel(el: ElementDTO): string {
  const props = el.props as { name?: string; text?: string };
  return props.name ?? props.text ?? `${el.type} ${el.id.slice(0, 4)}`;
}

function SortableRow({
  row, selected, locked, onSelect, onToggle, expanded, onRename, onSaveTemplate,
}: {
  row: Row;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onToggle: () => void;
  expanded: boolean;
  onRename: (name: string) => void;
  onSaveTemplate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.el.id,
  });
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(rowLabel(row.el));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: 8 + row.depth * 16,
  };

  const isFolder = row.el.type === "frame" || row.el.type === "group";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-1.5 rounded py-1 pr-2 text-xs ${
        selected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
      } ${locked ? "opacity-50" : ""}`}
    >
      {isFolder ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="w-3 shrink-0 text-gray-400"
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] font-semibold text-gray-500">
        {TYPE_LABEL[row.el.type] ?? "?"}
      </span>

      {editing ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onRename(nameDraft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded border border-blue-400 px-1 text-xs outline-none"
        />
      ) : (
        <span
          className="flex-1 truncate"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {rowLabel(row.el)}
        </span>
      )}

      {row.el.type === "group" && (
        <button
          title="Save as template"
          onClick={(e) => {
            e.stopPropagation();
            onSaveTemplate();
          }}
          className="shrink-0 text-gray-400 hover:text-blue-600"
        >
          ⭳
        </button>
      )}
    </div>
  );
}

export default function LayersPanel({
  boardId, elements, lockedBy, selectedIds, onSelect, send, currentUsername,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showTemplates, setShowTemplates] = useState(false);
  const queryClient = useQueryClient();

  const rows = useMemo(() => {
    const out: Row[] = [];
    buildRows(elements, null, 0, expanded, out);
    return out;
  }, [elements, expanded]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
    enabled: showTemplates,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: ({ elementId, name }: { elementId: string; name: string }) =>
      saveGroupAsTemplate(elementId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => applyTemplate(templateId, boardId, 200, 200),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rename = (el: ElementDTO, name: string) => {
    const key = el.type === "text" || el.type === "sticky" ? "text" : "name";
    send({ action: "element.update", id: el.id, props: { ...el.props, [key]: name } });
  };

  const createGroup = () => {
    const id = uuidv4();
    send({
      action: "element.create",
      element: { id, type: "group", props: { name: "New group" }, z_index: 0 },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedRow = rows.find((r) => r.el.id === active.id);
    const overRow = rows.find((r) => r.el.id === over.id);
    if (!draggedRow || !overRow) return;

    // Dropping directly onto a folder row nests inside it, at the top.
    // Dropping onto a leaf row reorders as a sibling, placed just above it.
    const isFolder = overRow.el.type === "frame" || overRow.el.type === "group";
    const newParentId = isFolder ? overRow.el.id : overRow.el.parent ?? null;

    const siblings = Object.values(elements)
      .filter((e) => (e.parent ?? null) === newParentId && e.id !== active.id)
      .sort((a, b) => b.z_index - a.z_index);

    let newZ: number;
    if (isFolder) {
      newZ = siblings.length ? siblings[0].z_index + 1 : 1000;
    } else {
      const overIndex = siblings.findIndex((s) => s.id === over.id);
      const above = siblings[overIndex - 1] ?? null; // higher z (earlier in list)
      const below = siblings[overIndex] ?? null;
      newZ = zIndexBetween(below, above);
    }

    send({ action: "element.move", id: draggedRow.el.id, parent_id: newParentId, z_index: newZ });
    if (isFolder) setExpanded((prev) => new Set(prev).add(overRow.el.id));
  };

  return (
    <div className="flex h-full w-64 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-600">Layers</span>
        <div className="flex gap-2">
          <button onClick={createGroup} title="New group" className="text-gray-400 hover:text-gray-700">
            +
          </button>
          <button
            onClick={() => setShowTemplates((v) => !v)}
            title="Saved templates"
            className={`text-gray-400 hover:text-gray-700 ${showTemplates ? "text-blue-600" : ""}`}
          >
            ⭳
          </button>
        </div>
      </div>

      {showTemplates ? (
        <div className="flex-1 overflow-y-auto p-2">
          {templates.length === 0 && (
            <p className="p-2 text-xs text-gray-400">
              No saved templates yet. Save a group from the layers list to reuse it later.
            </p>
          )}
          {templates.map((t: SavedTemplateDTO) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gray-50"
            >
              <span className="truncate">{t.name}</span>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => applyTemplateMutation.mutate(t.id)} className="text-blue-600 hover:underline">
                  Insert
                </button>
                <button onClick={() => deleteTemplateMutation.mutate(t.id)} className="text-red-500 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.el.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 overflow-y-auto p-1">
              {rows.map((row) => (
                <SortableRow
                  key={row.el.id}
                  row={row}
                  selected={selectedIds.has(row.el.id)}
                  locked={!!lockedBy[row.el.id] && lockedBy[row.el.id] !== currentUsername}
                  expanded={expanded.has(row.el.id)}
                  onToggle={() => toggleExpand(row.el.id)}
                  onSelect={() => onSelect(new Set([row.el.id]))}
                  onRename={(name) => rename(row.el, name)}
                  onSaveTemplate={() => {
                    const name = window.prompt("Template name:", "My template");
                    if (name) saveTemplateMutation.mutate({ elementId: row.el.id, name });
                  }}
                />
              ))}
              {rows.length === 0 && <p className="p-3 text-xs text-gray-400">Nothing on this board yet.</p>}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}