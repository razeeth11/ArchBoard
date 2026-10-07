import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Branded text card. No remote fonts or images, so it renders offline at build time. */
export function ogCard(o: { kicker: string; title: string; footer?: string }) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 30, letterSpacing: 2, textTransform: "uppercase", opacity: 0.8 }}>
        {o.kicker}
      </div>
      <div style={{ fontSize: o.title.length > 38 ? 68 : 84, fontWeight: 700, lineHeight: 1.1 }}>
        {o.title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32 }}>
        <span style={{ fontWeight: 700 }}>ArchBoard</span>
        <span style={{ opacity: 0.8 }}>
          {o.footer ?? "Free, private, offline-first whiteboard"}
        </span>
      </div>
    </div>,
    OG_SIZE,
  );
}
