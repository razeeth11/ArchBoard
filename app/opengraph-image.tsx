import { OG_SIZE, ogCard } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "ArchBoard: whiteboard for system design and architecture diagrams";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "System design whiteboard",
    title: "Draw architecture diagrams in your browser",
  });
}
