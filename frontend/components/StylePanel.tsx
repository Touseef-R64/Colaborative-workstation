"use client";

const PRESET_COLORS = ["#FEF3C7", "#BFDBFE", "#FCA5A5", "#BBF7D0", "#DDD6FE", "#FED7AA", "#F9A8D4", "#1F2937"];

export interface PenSettings {
  color: string;
  width: number;
  dash: "solid" | "dashed" | "dotted";
}

interface Props {
  target: { type: string; props: Record<string, unknown> } | null;
  tool: string;
  penSettings: PenSettings;
  onPenSettingsChange: (s: PenSettings) => void;
  onUpdateElement: (patch: Record<string, unknown>) => void;
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`h-5 w-5 rounded-full border ${value === c ? "ring-2 ring-blue-500" : "border-gray-200"}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
        />
      </div>
    </div>
  );
}

function DashRow({ value, onChange }: { value: string; onChange: (d: "solid" | "dashed" | "dotted") => void }) {
  return (
    <div className="mb-2 flex gap-1">
      {(["solid", "dashed", "dotted"] as const).map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`flex-1 rounded px-2 py-1 text-xs ${
            (value ?? "solid") === d ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function OpacityRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs font-medium text-gray-500">Opacity {Math.round(value * 100)}%</p>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function StylePanel({ target, tool, penSettings, onPenSettingsChange, onUpdateElement }: Props) {
  // Pen tool active, nothing relevant selected: edit the defaults new strokes will use.
  if (tool === "pen" && !target) {
    return (
      <div className="absolute bottom-4 left-1/2 z-10 w-56 -translate-x-1/2 rounded-lg border bg-white p-3 shadow-lg">
        <ColorRow label="Pen color" value={penSettings.color} onChange={(c) => onPenSettingsChange({ ...penSettings, color: c })} />
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium text-gray-500">Thickness {penSettings.width}px</p>
          <input
            type="range"
            min={1}
            max={20}
            value={penSettings.width}
            onChange={(e) => onPenSettingsChange({ ...penSettings, width: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
        <DashRow value={penSettings.dash} onChange={(d) => onPenSettingsChange({ ...penSettings, dash: d })} />
      </div>
    );
  }

  if (!target) return null;

  const props = target.props as {
    fill?: string;
    stroke?: string;
    opacity?: number;
    strokeWidth?: number;
    dash?: string;
  };
  const opacity = props.opacity ?? 1;

  return (
    <div className="absolute bottom-4 left-1/2 z-10 w-56 -translate-x-1/2 rounded-lg border bg-white p-3 shadow-lg">
      {(target.type === "shape" || target.type === "sticky") && (
        <ColorRow label="Fill" value={props.fill ?? "#BFDBFE"} onChange={(c) => onUpdateElement({ fill: c })} />
      )}
      {(target.type === "shape" || target.type === "frame") && (
        <ColorRow label="Stroke" value={props.stroke ?? "#1F2937"} onChange={(c) => onUpdateElement({ stroke: c })} />
      )}
      {target.type === "text" && (
        <ColorRow label="Text color" value={props.fill ?? "#111827"} onChange={(c) => onUpdateElement({ fill: c })} />
      )}
      {target.type === "stroke" && (
        <>
          <ColorRow label="Color" value={props.stroke ?? "#1F2937"} onChange={(c) => onUpdateElement({ stroke: c })} />
          <div className="mb-2">
            <p className="mb-1 text-xs font-medium text-gray-500">Thickness {props.strokeWidth ?? 3}px</p>
            <input
              type="range"
              min={1}
              max={20}
              value={props.strokeWidth ?? 3}
              onChange={(e) => onUpdateElement({ strokeWidth: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <DashRow value={props.dash ?? "solid"} onChange={(d) => onUpdateElement({ dash: d })} />
        </>
      )}
      <OpacityRow value={opacity} onChange={(v) => onUpdateElement({ opacity: v })} />
    </div>
  );
}