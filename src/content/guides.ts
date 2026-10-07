export interface GuideSection {
  heading: string;
  paragraphs: string[];
}
export interface Guide {
  slug: string;
  /** Page title without the site suffix; keep it under 50 characters. */
  title: string;
  /** Meta description, 130-160 characters. */
  description: string;
  updated: string;
  sections: GuideSection[];
  /** Template slugs that illustrate the guide. */
  templates: string[];
  /** Render extra interactive reference content after the sections. */
  extra?: "dsl";
}

export const GUIDES: Guide[] = [
  {
    slug: "system-design-diagram",
    title: "How to Draw a System Design Diagram",
    description:
      "A practical walkthrough for drawing clear system design diagrams: choose boundaries, label data flow and show scale and failure modes in ArchBoard.",
    updated: "2026-10-07",
    templates: ["three-tier-web-app", "url-shortener", "microservices-gateway"],
    sections: [
      {
        heading: "Start with the question the diagram answers",
        paragraphs: [
          "A diagram that tries to show everything shows nothing. Before you draw a box, write one sentence: what should a reader understand after looking at this for thirty seconds? Maybe it is how a request travels from a browser to the database, or where data is copied, or which components fail together. That sentence decides what to include and, just as importantly, what to leave out.",
        ],
      },
      {
        heading: "Draw the boundaries first",
        paragraphs: [
          "Begin with the big containers: the clients, your system, and the outside services you depend on. Inside your system, group components that are deployed or owned together, such as a region, a cluster or a team's services. Boundaries let a reader see at once what is yours, what is rented and what crosses a trust line. In ArchBoard, frames work well as boundaries, and the Boundaries category in the component panel provides labelled regions you can resize.",
        ],
      },
      {
        heading: "Place components, then connect them",
        paragraphs: [
          "Add one box per thing that can fail or scale independently. A load balancer in front of three identical servers is one box labelled with a count, not three arrows to three boxes, unless the replicas matter to the story. Draw arrows to show who initiates a call, label each with the protocol or the data it carries, and keep the dominant flow running in one direction, usually left to right or top to bottom.",
          "Use consistent shapes and colours for kinds of components. Databases, queues and caches should look the same everywhere in your diagram, which is why the building blocks in ArchBoard carry a category colour and an icon.",
        ],
      },
      {
        heading: "Show scale and failure",
        paragraphs: [
          "Add the numbers that drive the design: requests per second, data size, the replication factor. Then mark what happens when something breaks. A dashed arrow to a standby, a note saying reads fall back to the replica, or a queue drawn between two services all communicate resilience better than a paragraph of text.",
        ],
      },
      {
        heading: "Review it like a stranger",
        paragraphs: [
          "Ask someone who has not seen it to explain it back to you. Wherever they hesitate, add a label or remove a box. Export the result as SVG or PDF for documents, keep the editable scene in your workspace, and use version history to save a named checkpoint before a big edit.",
        ],
      },
    ],
  },
  {
    slug: "diagram-dsl",
    title: "Diagram DSL: Draw Architecture from Text",
    description:
      "The ArchBoard diagram DSL: nodes, edges, labels, replicas, layouts and a dozen copy-paste examples. Type text and get an editable, auto-laid-out diagram.",
    updated: "2026-10-07",
    templates: ["url-shortener", "pubsub-fanout"],
    extra: "dsl",
    sections: [
      {
        heading: "Why text",
        paragraphs: [
          "Dragging boxes is good for exploring, but a text description is faster to write, easy to review in a pull request and trivial to change. The ArchBoard DSL turns a few readable lines into real Excalidraw shapes, with icons, bound arrows and an automatic layout, so you can then tweak the result by hand like any other drawing.",
        ],
      },
    ],
  },
  {
    slug: "choosing-diagram-types",
    title: "Choosing the Right Diagram Type",
    description:
      "Architecture, sequence, data flow, entity and deployment diagrams answer different questions. Learn which to draw and when to combine several.",
    updated: "2026-10-07",
    templates: ["cqrs", "oauth-login", "kubernetes-ingress"],
    sections: [
      {
        heading: "Pick the diagram by the question",
        paragraphs: [
          "People argue about notation when they should ask what they need to explain. A component or architecture diagram answers what the parts are and how they connect. A sequence diagram answers in what order things happen between them. A data flow diagram answers where information moves and where it is stored. An entity diagram answers what the data looks like, and a deployment diagram answers where the software actually runs.",
        ],
      },
      {
        heading: "When an architecture diagram is enough",
        paragraphs: [
          "For most design discussions a single boxes and arrows picture of components is the right tool. It is quick to read, tolerant of imprecision and easy to redraw as the design changes. Keep it to one level of detail: if you find yourself drawing both a whole subsystem and a single function in the same picture, split it in two.",
        ],
      },
      {
        heading: "When to switch to a sequence diagram",
        paragraphs: [
          "As soon as order, retries or timing matter, such as an authentication handshake or a payment with a webhook, numbered arrows on an architecture diagram start to strain. The OAuth template shows a workable compromise: numbered, labelled arrows between the same few nodes. If the numbering gets past about eight steps, move to a dedicated sequence diagram. Mermaid import in ArchBoard supports sequence diagrams as editable shapes.",
        ],
      },
      {
        heading: "Deployment and data views",
        paragraphs: [
          "Show deployment when the audience cares about regions, clusters or networks, and show data when they care about copies and ownership. Resist combining them with the logical architecture on one canvas; use separate pages in the same scene so each picture stays honest and readable. Pages are the tabs at the bottom of the ArchBoard editor.",
        ],
      },
    ],
  },
  {
    slug: "draw-microservices-architecture",
    title: "Drawing a Microservices Architecture",
    description:
      "Show service boundaries, data ownership, sync and async calls clearly in a microservices diagram, without drowning the reader in a tangle of arrows.",
    updated: "2026-10-07",
    templates: ["microservices-gateway", "backend-for-frontend", "strangler-fig-migration"],
    sections: [
      {
        heading: "Draw capabilities, not code modules",
        paragraphs: [
          "Each box should be something a team could own end to end: orders, catalogue, identity. If the box names read like technical layers, such as controller or repository, you are drawing a single service from the inside. Zoom out until every box has its own deployment and its own data.",
        ],
      },
      {
        heading: "Make data ownership visible",
        paragraphs: [
          "Attach each service to its own database with a short, unambiguous line. If two services point at one database, the diagram is telling you something uncomfortable, and it should stay visible rather than be hidden. Shared data is the most common source of hidden coupling in these systems.",
        ],
      },
      {
        heading: "Distinguish synchronous and asynchronous calls",
        paragraphs: [
          "Use solid arrows for request and response calls, and dashed arrows or an explicit queue shape for events. Readers need to know which failures propagate immediately and which are absorbed by a broker. Label event arrows with the event name instead of the verb, for example order created.",
        ],
      },
      {
        heading: "Keep the gateway and cross-cutting parts quiet",
        paragraphs: [
          "Authentication, logging and tracing touch every service. Draw them once, at the edge or as a band underneath, rather than adding an arrow from each service. The microservices template uses a single gateway for this reason. If you need to show the full mesh, make it a second page so the first remains readable.",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        paragraphs: [
          "Three habits make microservice diagrams misleading. Drawing every instance instead of the service hides the real boundaries. Drawing only the happy path hides the failure handling that defines the system. And drawing today's design as if it were permanent invites arguments later. Date the diagram, say what it is meant to show, and keep older versions in history so the evolution stays visible.",
        ],
      },
    ],
  },
  {
    slug: "system-design-interview-diagrams",
    title: "Diagrams for System Design Interviews",
    description:
      "How to use a whiteboard in a system design interview: a repeatable drawing order, what to label, and how to keep the picture clean while you talk it through.",
    updated: "2026-10-07",
    templates: ["url-shortener", "chat-application", "news-feed", "rate-limiter"],
    sections: [
      {
        heading: "A repeatable drawing order",
        paragraphs: [
          "Interviewers watch how you think as much as what you draw, so use the same order every time. Clarify requirements and write them down in a corner. Sketch the simplest end to end path: client, server, database. Then add the parts the requirements force on you, one at a time, and say why before you draw each one.",
        ],
      },
      {
        heading: "Do the numbers on the board",
        paragraphs: [
          "Write requests per second, storage per year and read to write ratio next to the picture. They justify the boxes you add. A cache appears because reads outnumber writes by a hundred to one, not because every diagram has a cache. Back of the envelope maths in the margin is also easy for the interviewer to correct kindly.",
        ],
      },
      {
        heading: "Leave room and label the arrows",
        paragraphs: [
          "Start in the middle left and leave space on the right, because the design will grow. Label arrows with the call or the data, for example write post or fetch feed. A box with no labelled arrows is a guess; a box with a label is a decision.",
        ],
      },
      {
        heading: "Practise with templates",
        paragraphs: [
          "Open a template such as the URL shortener, redraw it from memory on a blank page, and compare. The goal is not to memorise a design but to make drawing the building blocks fast, so your attention stays on the trade-offs. Because ArchBoard works offline in your browser, you can practise anywhere without an account.",
        ],
      },
      {
        heading: "Handling questions",
        paragraphs: [
          "When the interviewer pushes on a choice, resist redrawing everything. Point to the box, state the trade-off in one sentence, and amend the picture only if the answer changes the design. A calm edit, such as adding a replica or a queue, shows you can adapt without panicking, and the history of small changes tells the story of how your reasoning evolved.",
        ],
      },
    ],
  },
  {
    slug: "back-of-envelope-estimation",
    title: "Back-of-the-Envelope Estimation",
    description:
      "Estimate traffic, storage and bandwidth for a system design in minutes. A simple method, the numbers worth memorising and how to show them on your diagram.",
    updated: "2026-10-07",
    templates: ["url-shortener", "video-streaming", "metrics-monitoring"],
    sections: [
      {
        heading: "Why estimate at all",
        paragraphs: [
          "An estimate does not need to be right; it needs to be within a factor of ten, because that is the difference between one machine and a cluster. A rough number tells you whether a single database is enough, whether a cache will fit in memory and whether you should worry about bandwidth.",
        ],
      },
      {
        heading: "The method",
        paragraphs: [
          "Start with users and turn them into requests per second: daily active users, times actions per user per day, divided by about eighty thousand seconds in a day. Multiply by two or three for peak. Next, size the data: bytes per record times records per day times retention. Finally, bandwidth is requests per second times bytes per response.",
          "Round aggressively. Treat a day as roughly one hundred thousand seconds, and a million as ten to the sixth. Write the units every time; most mistakes are a confused kilobyte and megabyte.",
        ],
      },
      {
        heading: "Numbers worth remembering",
        paragraphs: [
          "Memory reads take about a hundred nanoseconds, a solid state disk read about a hundred microseconds and a cross-region round trip around a hundred milliseconds. A single well tuned database node handles thousands of simple queries per second, not millions. These ratios, rather than exact figures, drive most design choices.",
        ],
      },
      {
        heading: "Put the result on the diagram",
        paragraphs: [
          "Write the key numbers beside the component they affect: peak requests per second by the load balancer, storage per year by the database, cache size by the cache. In ArchBoard you can add them as text notes or as the label of a smart component, and keep the working in a second page so the figures can be audited later.",
        ],
      },
    ],
  },
  {
    slug: "mermaid-in-archboard",
    title: "Using Mermaid with ArchBoard",
    description:
      "Import Mermaid flowcharts as editable shapes and export a selection back to Mermaid text. What converts well, what does not and how to keep diagrams in sync.",
    updated: "2026-10-07",
    templates: ["pubsub-fanout", "cache-aside"],
    sections: [
      {
        heading: "Why use both",
        paragraphs: [
          "Mermaid lives happily in a README and renders on code hosts, while a whiteboard is better for exploring and polishing. ArchBoard lets you move between them: paste Mermaid text and get editable shapes, or export a flowchart selection back to Mermaid text for your documentation.",
        ],
      },
      {
        heading: "Importing",
        paragraphs: [
          "Open Tools, choose Mermaid import and export, and paste your text. A live preview shows the result and any parse error. Flowcharts, sequence diagrams and class diagrams become native shapes you can restyle and rearrange. Other diagram types arrive as an image, which is how the underlying converter behaves. Mermaid runs locally in the browser with its strict security setting, so nothing is sent anywhere.",
        ],
      },
      {
        heading: "Exporting",
        paragraphs: [
          "Select the shapes you want, or leave nothing selected to use the whole page, and open the export tab. Rectangles, ellipses and diamonds connected by bound arrows become flowchart nodes and edges, with labels preserved and dashed arrows kept dashed. Anything Mermaid cannot express faithfully, such as freehand strokes, is skipped rather than approximated, and the dialog shows how many nodes and edges were exported.",
        ],
      },
      {
        heading: "A workable routine",
        paragraphs: [
          "Sketch and refine in ArchBoard, export to Mermaid when the structure is stable, and commit the text beside your code. When the design changes, edit the Mermaid text and re-import it to regenerate shapes. Use auto-layout afterwards to tidy the result in one click.",
        ],
      },
      {
        heading: "Limits worth knowing",
        paragraphs: [
          "Mermaid is a text language with its own layout engine, so exact positions do not survive a round trip. Expect the structure and labels to come back, and plan to re-run auto-layout rather than hand-place nodes you intend to export again. Styling you add in the canvas, such as colours and icons, is not represented in Mermaid text, which keeps documentation diagrams simple and consistent.",
        ],
      },
    ],
  },
  {
    slug: "offline-first-diagramming",
    title: "Offline-First, Private Diagramming",
    description:
      "How ArchBoard keeps diagrams on your device: local storage, no accounts, no tracking, and how to back up, move and share work without any server involved.",
    updated: "2026-10-07",
    templates: ["three-tier-web-app", "multi-tenant-saas"],
    sections: [
      {
        heading: "Your drawings stay on your device",
        paragraphs: [
          "ArchBoard has no accounts and no backend. Scenes are saved in your browser's IndexedDB as you draw, so closing a tab never loses work and nothing is uploaded. There are no third-party trackers, and optional network features, such as searching an online icon set, are off by default and clearly labelled.",
        ],
      },
      {
        heading: "What local storage means for you",
        paragraphs: [
          "Browser storage belongs to one browser profile on one device. Clearing site data or using a different browser starts you with an empty workspace. The editor asks the browser to treat the data as persistent and shows when storage is low, but a backup is the only real protection.",
        ],
      },
      {
        heading: "Back up and move work",
        paragraphs: [
          "Use the backup action in the scenes panel to download every scene, folder and image as one file, and import it on another browser to restore. Individual scenes can be exported as PNG or SVG with the scene embedded, so the picture itself can be opened again for editing. A periodic reminder nudges you if you have not backed up recently.",
        ],
      },
      {
        heading: "Working without a connection",
        paragraphs: [
          "Fonts, icons and the editor itself are served from the same origin, so drawing, exporting and version history work without a network once the page has loaded. Features that need a network, such as an online icon search, fail quietly and never block editing.",
        ],
      },
      {
        heading: "Practical habits",
        paragraphs: [
          "Treat the browser workspace as a working copy rather than an archive. Export a backup whenever you finish something important, keep exported files in your normal storage, and name scenes so they can be found by search later. If you share a computer, remember that anyone using the same browser profile can open your scenes, so use a separate profile or clear site data when you are done.",
        ],
      },
    ],
  },
  {
    slug: "event-driven-architecture-diagrams",
    title: "Diagramming Event-Driven Systems",
    description:
      "Show producers, topics, consumers, retries and replays in an event-driven architecture diagram so the flow of events stays understandable as the system grows.",
    updated: "2026-10-07",
    templates: ["pubsub-fanout", "saga-orchestration", "outbox-pattern", "dead-letter-queue"],
    sections: [
      {
        heading: "Make the broker the centre",
        paragraphs: [
          "In an event-driven design the interesting part is what flows through the middle. Put the topics or queues in the centre of the diagram, producers on the left and consumers on the right. Name each topic after what happened, such as order created, so the diagram reads like a list of facts.",
        ],
      },
      {
        heading: "Show who knows about whom",
        paragraphs: [
          "The great virtue of events is that a producer does not know its consumers, so do not draw arrows from producer to consumer. Draw an arrow into the topic and an arrow out of it. If a reader can add a consumer without redrawing the producer, your diagram matches your architecture.",
        ],
      },
      {
        heading: "Draw the unhappy paths",
        paragraphs: [
          "Retries, dead letter queues and replay tools are where event systems actually live. Add them explicitly: a dashed arrow from the consumer back to the queue for retries, a separate dead letter queue and an alert. The dead letter template does this in six nodes and is a good starting point to copy.",
        ],
      },
      {
        heading: "Record ordering and delivery guarantees",
        paragraphs: [
          "Annotate the topic with its partitioning key and delivery guarantee, for example ordered per order id, at least once. Those two facts determine whether consumers need to deduplicate and whether they can rely on sequence, and they are the details people forget until production.",
        ],
      },
      {
        heading: "Keep one diagram per business flow",
        paragraphs: [
          "A single picture of every topic and consumer in a company turns into a hairball. Draw one diagram per business flow, such as placing an order, and link them by the topics they share. Each page then answers one question, and a new teammate can follow a single event from cause to every effect without untangling unrelated traffic.",
        ],
      },
    ],
  },
  {
    slug: "presenting-architecture-diagrams",
    title: "Presenting Architecture Diagrams",
    description:
      "Turn a diagram into a talk: use frames as slides, speaker notes, a laser pointer and a PDF handout, all from one canvas and without leaving the editor.",
    updated: "2026-10-07",
    templates: ["three-tier-web-app", "multi-region-active-passive"],
    sections: [
      {
        heading: "One canvas, many slides",
        paragraphs: [
          "Architecture talks are best when each step zooms into the same picture rather than switching to a new one. In ArchBoard every frame on the canvas is a slide. Draw a frame around the whole system for the overview, then a frame around the part you discuss next, and the presentation follows them in reading order, top to bottom and left to right.",
        ],
      },
      {
        heading: "Notes and navigation",
        paragraphs: [
          "Open Tools, then Slides and notes, to type speaker notes for each frame. While presenting, the arrow keys, Page Up, Page Down and Space move between slides, Home and End jump to the first and last, N shows or hides your notes, L toggles the laser pointer and Escape leaves the presentation and restores your previous view.",
        ],
      },
      {
        heading: "Handouts",
        paragraphs: [
          "Export the deck as a PDF with one page per frame for people who want to read at their own pace. The PDF keeps vector graphics, so diagrams stay sharp when zoomed. For a document, export a single frame as SVG instead.",
        ],
      },
      {
        heading: "Keep slides sparse",
        paragraphs: [
          "Reveal complexity gradually. Duplicate the page, add the next layer of detail, and let the frames show the progression. If a slide needs more than about a dozen labelled boxes, split it. The audience should be looking at you for part of the time.",
        ],
      },
      {
        heading: "Rehearse with the real thing",
        paragraphs: [
          "Run through the presentation once before the audience arrives. Check that every frame fits its content, that the notes make sense out of context and that the order is what you intend. Because the slides are the live canvas, you can fix a typo on the spot and carry on, which is a good reason to keep a second window with the editor open while you talk.",
        ],
      },
    ],
  },
  {
    slug: "share-diagrams-safely",
    title: "Sharing Diagrams Without a Server",
    description:
      "Create encrypted share links, read-only views and exported files from ArchBoard, and understand what a link does and does not protect, with its size limits.",
    updated: "2026-10-07",
    templates: ["zero-trust-access", "oauth-login"],
    sections: [
      {
        heading: "How a share link works",
        paragraphs: [
          "ArchBoard has no server to store a shared diagram, so the diagram travels inside the link. It is compressed, then encrypted with AES-GCM using a random key, and both the ciphertext and the key are placed in the part of the URL after the hash sign. Browsers do not send that part to servers, so the site hosting ArchBoard never sees your diagram.",
        ],
      },
      {
        heading: "View and edit links",
        paragraphs: [
          "A view link opens a read-only canvas with a button to save a copy into the recipient's own workspace. An edit link opens a fresh copy straight away. Either way the recipient's changes never flow back to you, because there is nothing to sync with.",
        ],
      },
      {
        heading: "What a link does not protect",
        paragraphs: [
          "Anyone who holds the entire link can read the diagram, because the key is inside it. Treat the link like a password: send it through a channel you trust, and do not put it in a public ticket. There is no revocation, since there is no server to revoke it on.",
        ],
      },
      {
        heading: "Size limits and alternatives",
        paragraphs: [
          "Links work for small and medium diagrams. The dialog warns once the link passes about eight thousand characters, because some chat apps truncate long URLs, and refuses above thirty two thousand. Turning off images shortens a link dramatically. For anything larger, export a file, such as an editable PNG or SVG with the scene embedded, or a backup.",
        ],
      },
      {
        heading: "Choosing between link and file",
        paragraphs: [
          "Use a link for quick feedback on a modest diagram with someone you trust. Use an exported file when the diagram is large, when you need an archive or when the recipient should be able to keep it without relying on a URL surviving a chat tool. Whichever you choose, remember that exporting is always your decision; nothing in ArchBoard leaves the browser by itself.",
        ],
      },
    ],
  },
  {
    slug: "version-your-diagrams",
    title: "Version History for Diagrams",
    description:
      "Use automatic snapshots, named checkpoints and safe restore in ArchBoard to experiment freely with a design and recover any earlier version of a diagram.",
    updated: "2026-10-07",
    templates: ["blue-green-deployment", "strangler-fig-migration"],
    sections: [
      {
        heading: "Snapshots happen for you",
        paragraphs: [
          "While you work, ArchBoard quietly saves compressed snapshots of the scene every few minutes. Recent ones are kept at fine granularity and older ones are thinned out: roughly one every five minutes for the past hour, hourly for the past day and daily for the past month. Storage stays bounded, and you rarely need to think about it.",
        ],
      },
      {
        heading: "Name the moments that matter",
        paragraphs: [
          "Before a risky rewrite, or when a design is approved, open Tools, then Version history, type a short name and save a checkpoint. Named checkpoints are never pruned. You can also rename an automatic snapshot to promote it, which is handy when you notice a good state after the fact.",
        ],
      },
      {
        heading: "Compare before you restore",
        paragraphs: [
          "Selecting a snapshot shows it side by side with the current scene and summarises what was added, removed or changed. If it is the one you want, restore it. The restore itself is safe: ArchBoard first saves your current state as a before-restore copy, so you can always go back to it from the same list.",
        ],
      },
      {
        heading: "Pages and exports as a complement",
        paragraphs: [
          "Use pages for alternative designs you want to keep visible together, and snapshots for the passage of time. For a permanent record outside the browser, export an SVG or PDF and commit it beside the code or the decision record it belongs to.",
        ],
      },
      {
        heading: "Habits that pay off",
        paragraphs: [
          "Save a named checkpoint before sharing a diagram, before restructuring it, and at the end of each working session if the design moved. Keep names short and dated, for example approved design review, so the list reads like a changelog. When you restore, look at the diff first; it takes a few seconds and prevents rolling back more than you meant to.",
        ],
      },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
