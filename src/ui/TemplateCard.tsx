import Link from "next/link";
import type { Template } from "@/content/types";

export function TemplateCard({ t }: { t: Template }) {
  return (
    <li className="border-border bg-surface overflow-hidden rounded-xl border">
      <Link href={`/templates/${t.slug}`} className="block">
        {/* Static pre-rendered SVG thumbnail (scripts/build-previews.mjs); fixed ratio avoids layout shift. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/previews/${t.slug}.svg`}
          alt={`${t.title} architecture diagram preview`}
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full bg-white object-contain"
        />
        <div className="p-3">
          <h3 className="font-semibold">{t.title}</h3>
          <p className="text-muted mt-1 text-sm">{t.summary}</p>
        </div>
      </Link>
    </li>
  );
}
