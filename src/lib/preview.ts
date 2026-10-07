import type { BinaryFileData } from "@excalidraw/excalidraw/types";

/** Render elements to an SVG object URL for a live preview. Caller revokes the URL. */
export async function previewUrl(
  elements: readonly unknown[],
  files: Record<string, BinaryFileData> = {},
): Promise<string | null> {
  const live = (elements as { isDeleted?: boolean }[]).filter((e) => !e.isDeleted);
  if (!live.length) return null;
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const svg = await exportToSvg({
    elements: live as never,
    files: files as never,
    appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
    exportPadding: 16,
  });
  const text = new XMLSerializer().serializeToString(svg);
  return URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
}
