import Link from "next/link";
import { EditorLoader } from "@/engine/EditorLoader";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ArchBoard Editor – Draw Architecture Diagrams Online",
  description:
    "Open the ArchBoard whiteboard: draw system design and architecture diagrams in your browser with autosave, offline support and no sign-up required.",
  path: "/app",
});

export default function AppPage() {
  return (
    <>
      <noscript>
        <main className="mx-auto max-w-2xl p-6">
          <h1>ArchBoard editor</h1>
          <p>
            ArchBoard is a browser-based whiteboard for architecture diagrams. It needs JavaScript
            to draw. Your data stays on your device. <Link href="/">Back to home</Link>.
          </p>
        </main>
      </noscript>
      <EditorLoader />
    </>
  );
}
