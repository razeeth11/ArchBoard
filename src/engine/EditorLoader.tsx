"use client";

import dynamic from "next/dynamic";

function Skeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-surface text-muted flex h-dvh items-center justify-center"
    >
      Loading editor…
    </div>
  );
}

const Editor = dynamic(() => import("./Editor"), { ssr: false, loading: Skeleton });

export function EditorLoader() {
  return <Editor />;
}
