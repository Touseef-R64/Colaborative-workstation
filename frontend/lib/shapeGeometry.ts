export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond" | "star" | "line" | "polygon";

export const SHAPE_KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "Rectangle" },
  { kind: "ellipse", label: "Ellipse" },
  { kind: "triangle", label: "Triangle" },
  { kind: "diamond", label: "Diamond" },
  { kind: "star", label: "Star" },
  { kind: "line", label: "Line" },
  { kind: "polygon", label: "Polygon" },
];

export const DASH_PATTERNS: Record<string, number[] | undefined> = {
  solid: undefined,
  dashed: [10, 6],
  dotted: [2, 5],
};

// Every non-rect shape is rendered as a Konva Line with points relative to
// (0,0) — the Line node itself is positioned via x/y like every other
// element, so drag/resize/undo code never needs to know or care which kind
// of shape it's touching.

export function ellipsePoints(width: number, height: number, segments = 40): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const points: number[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (Math.PI * 2 * i) / segments;
    points.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return points;
}

export function trianglePoints(width: number, height: number): number[] {
  return [width / 2, 0, width, height, 0, height];
}

export function diamondPoints(width: number, height: number): number[] {
  return [width / 2, 0, width, height / 2, width / 2, height, 0, height / 2];
}

export function starPoints(width: number, height: number, numPoints = 5): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * 0.5;
  const points: number[] = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / numPoints - Math.PI / 2;
    points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  return points;
}

export function polygonPoints(width: number, height: number, sides = 6): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const points: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    points.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return points;
}

export function linePoints(width: number, height: number): number[] {
  return [0, 0, width, height];
}

export function pointsForKind(kind: Exclude<ShapeKind, "rect">, width: number, height: number): number[] {
  switch (kind) {
    case "ellipse":
      return ellipsePoints(width, height);
    case "triangle":
      return trianglePoints(width, height);
    case "diamond":
      return diamondPoints(width, height);
    case "star":
      return starPoints(width, height);
    case "polygon":
      return polygonPoints(width, height);
    case "line":
      return linePoints(width, height);
  }
}