"use client";

import dynamic from "next/dynamic";
import { use } from "react";

// Konva touches window at import time, so load the canvas client-only.
const Canvas = dynamic(() => import("@/components/Canvas"), { ssr: false });

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Canvas boardId={id} />;
}
