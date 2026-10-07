"use client";

import { useEffect, useState } from "react";
import { getIcon, type IconData } from "@/library/icons";

const cache = new Map<string, IconData | null>();

/** Renders an icon from the bundled sets (trusted build output) or pre-sanitized data. */
export function IconPreview({
  iconRef,
  data,
  size = 28,
}: {
  iconRef?: string;
  data?: IconData;
  size?: number;
}) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (data || !iconRef || cache.has(iconRef)) return;
    let alive = true;
    void getIcon(iconRef)
      .catch(() => null)
      .then((icon) => {
        cache.set(iconRef, icon);
        if (alive) bump((n) => n + 1);
      });
    return () => {
      alive = false;
    };
  }, [iconRef, data]);

  const icon = data ?? (iconRef ? (cache.get(iconRef) ?? null) : null);
  if (!icon) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="bg-surface inline-block rounded"
      />
    );
  }
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      className="text-fg shrink-0"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
