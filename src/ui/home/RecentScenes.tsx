"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBlob, listScenes } from "@/persistence/repo";
import type { Scene } from "@/persistence/types";

interface Item {
  scene: Scene;
  thumb: string | null;
}

const rtf =
  typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
export function ago(ts: number, now = Date.now()): string {
  const s = Math.round((ts - now) / 1000);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
  ];
  let v = s;
  for (const [div, unit] of steps) {
    if (Math.abs(v) < div)
      return rtf ? rtf.format(Math.round(v), unit) : `${Math.abs(Math.round(v))} ${unit}s ago`;
    v /= div;
  }
  return rtf ? rtf.format(Math.round(v), "year") : "long ago";
}

/** Figma-style "recent" on the home page: your local scenes, newest first; opening one resumes it. */
export function RecentScenes() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    void (async () => {
      try {
        const scenes = (await listScenes())
          .filter((s) => !s.deletedAt)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 8);
        const out: Item[] = [];
        for (const scene of scenes) {
          let thumb: string | null = null;
          if (scene.thumbnailBlobId) {
            const b = await getBlob(scene.thumbnailBlobId).catch(() => undefined);
            if (b) {
              thumb = URL.createObjectURL(new Blob([b.bytes as BlobPart], { type: b.mime }));
              urls.push(thumb);
            }
          }
          out.push({ scene, thumb });
        }
        if (alive) setItems(out);
      } catch {
        if (alive) setItems([]); // storage unavailable: the section simply stays empty
      }
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  if (!items || items.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading" className="mt-16" data-testid="recent-scenes">
      <h2 id="recent-heading" className="text-2xl font-semibold">
        Recent
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <Link
            href="/app"
            className="border-border bg-surface hover:border-accent flex aspect-video h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed"
          >
            <Plus size={22} aria-hidden />
            <span className="font-medium">New whiteboard</span>
          </Link>
        </li>
        {items.map(({ scene, thumb }) => (
          <li key={scene.id} className="border-border bg-surface overflow-hidden rounded-xl border">
            <Link
              href={`/app?scene=${scene.id}`}
              prefetch={false}
              className="block"
              data-testid="recent-item"
            >
              <div className="bg-bg flex aspect-video items-center justify-center">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    width={320}
                    height={180}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-muted text-sm">Empty</span>
                )}
              </div>
              <div className="p-3">
                <div className="truncate font-medium">{scene.title}</div>
                <div className="text-muted text-xs">Edited {ago(scene.updatedAt)}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
