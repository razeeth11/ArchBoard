export interface Comparison {
  slug: string;
  /** Competitor's name as it appears in running text. */
  name: string;
  title: string;
  description: string;
  /** Where the competitor is the better pick. Honest, specific and verifiable. */
  theyAreBetter: string[];
  weAreBetter: string[];
  summary: string;
  reviewed: string;
}

/**
 * These pages avoid claims about pricing, limits or roadmaps, which change often. They compare
 * architecture-level properties that follow from how each product is built. `reviewed` is the date
 * a person last checked the statements; re-verify before changing it.
 */
export const COMPARISONS: Comparison[] = [
  {
    slug: "excalidraw",
    name: "Excalidraw",
    title: "ArchBoard vs Excalidraw",
    description:
      "ArchBoard is built on the Excalidraw editor and adds a local workspace, system design components, auto-layout and export tools. See what each is best for.",
    summary:
      "ArchBoard uses the open source Excalidraw editor for drawing, so the hand-drawn look and file format are the same. The difference is everything around the canvas: a multi-scene local workspace, architecture building blocks, parametric components, a text DSL, auto-layout and a larger export suite.",
    theyAreBetter: [
      "You want the plainest possible whiteboard with the fewest options and a huge community of shared libraries.",
      "You rely on Excalidraw's own live collaboration features, which ArchBoard does not offer today.",
      "You prefer the official hosted app and its integrations over a separate tool.",
    ],
    weAreBetter: [
      "You keep many diagrams and want folders, search, version history and pages stored locally in the browser.",
      "You draw architecture often and want ready-made components, icons and templates, plus smart components that regenerate when you change a property.",
      "You want to describe a diagram in text, auto-layout it and export vector PDFs or text-outlined SVGs.",
    ],
    reviewed: "2026-10-07",
  },
  {
    slug: "draw-io",
    name: "draw.io (diagrams.net)",
    title: "ArchBoard vs draw.io",
    description:
      "Compare ArchBoard with draw.io (diagrams.net): freehand whiteboard feel versus a precise diagram editor, offline use, file formats, and when each fits best.",
    summary:
      "draw.io is a mature, precise diagramming editor with an enormous shape library and many integrations. ArchBoard is a sketch-style whiteboard focused on system design, with local-first storage and quick creation from text or templates.",
    theyAreBetter: [
      "You need strict, formal diagrams such as UML, BPMN or network diagrams with large specialised shape libraries.",
      "You want pixel-precise alignment, layers and formal styling for documents and compliance work.",
      "Your team stores diagrams in tools that integrate directly with draw.io files.",
    ],
    weAreBetter: [
      "You want a relaxed, hand-drawn look that signals a design is still open to discussion.",
      "You want to start from a system design template or a few lines of text and tidy the result with one click of auto-layout.",
      "You prefer no accounts and a workspace that lives only in your browser, with presentations built from frames.",
    ],
    reviewed: "2026-10-07",
  },
  {
    slug: "lucidchart",
    name: "Lucidchart",
    title: "ArchBoard vs Lucidchart",
    description:
      "ArchBoard and Lucidchart compared for architecture diagrams: local-first privacy versus a hosted collaboration platform, with strengths on both sides.",
    summary:
      "Lucidchart is a hosted collaboration platform with accounts, shared workspaces and integrations. ArchBoard is a single-user, browser-only tool with no accounts, where diagrams stay on your device unless you export or share them.",
    theyAreBetter: [
      "Several people must edit the same diagram at the same time, with comments, permissions and an audit of who changed what.",
      "You want diagrams generated from cloud accounts or tied into a wider suite of business tools.",
      "Your organisation needs centrally administered access and sharing controls.",
    ],
    weAreBetter: [
      "You cannot or do not want to upload architecture details to a third-party service; ArchBoard has no backend to receive them.",
      "You want to work offline, without signing in, on your own machine.",
      "You value a fast, sketch-style canvas with a text DSL, templates and exportable vector files.",
    ],
    reviewed: "2026-10-07",
  },
  {
    slug: "miro",
    name: "Miro",
    title: "ArchBoard vs Miro",
    description:
      "ArchBoard versus Miro for system design work: a focused offline diagramming tool compared with a large collaborative whiteboard for workshops and teams.",
    summary:
      "Miro is a broad collaborative whiteboard for workshops, brainstorming and planning. ArchBoard is narrower on purpose: it is for drawing software architecture, with components, a diagram DSL and local storage.",
    theyAreBetter: [
      "You run live workshops with many participants, sticky notes, voting and facilitation tools.",
      "You need boards that stakeholders open and comment on from a shared link with accounts.",
      "You want one place for roadmaps, retrospectives and diagrams together.",
    ],
    weAreBetter: [
      "Your task is a technical diagram, and you want building blocks, icons and layouts made for that purpose.",
      "You want your work to stay private on your device and usable without a connection after the page loads.",
      "You want to write a diagram as text, version it and export clean SVG or PDF.",
    ],
    reviewed: "2026-10-07",
  },
  {
    slug: "mermaid",
    name: "Mermaid",
    title: "ArchBoard vs Mermaid",
    description:
      "Mermaid draws diagrams from text and renders them in docs; ArchBoard is a visual editor that also imports and exports Mermaid. Learn when to use each.",
    summary:
      "Mermaid and ArchBoard are complementary more than competing. Mermaid excels at text diagrams that live in Markdown and render in documentation. ArchBoard is a freeform canvas where you can import Mermaid, rearrange the result by hand and export flowcharts back.",
    theyAreBetter: [
      "You want diagrams that live as text in a repository and render automatically inside Markdown on code hosts.",
      "You need many diagram types, such as Gantt charts or state machines, described entirely in code.",
      "You want diffs of a diagram to read as a plain text change in review.",
    ],
    weAreBetter: [
      "You want to move boxes, add icons and annotate freely without fighting an automatic layout.",
      "You want a presentation, comments, version history and pages around the same drawing.",
      "You want the best of both: import Mermaid into the canvas, polish it and export a flowchart back to text.",
    ],
    reviewed: "2026-10-07",
  },
];

export const comparisonBySlug = (slug: string) => COMPARISONS.find((c) => c.slug === slug);
