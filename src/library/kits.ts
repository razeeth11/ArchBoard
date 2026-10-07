import { Builder, DEFAULT_STYLE, type BuiltItem, type StyleCtx } from "./builder";

export type KitId =
  "uml" | "sequence" | "erd" | "c4" | "flowchart" | "network" | "wireframe" | "dfd";

export const KITS: { id: KitId; name: string; description: string }[] = [
  {
    id: "uml",
    name: "UML",
    description: "Class, interface, component, state, activity and use-case shapes.",
  },
  {
    id: "sequence",
    name: "Sequence",
    description: "Lifelines, activation bars, messages, self-calls and fragments.",
  },
  { id: "erd", name: "ERD", description: "Entity tables and crow's-foot relationship connectors." },
  {
    id: "c4",
    name: "C4 model",
    description: "Person, system, container, component and boundary in standard C4 colours.",
  },
  {
    id: "flowchart",
    name: "Flowchart / BPMN-lite",
    description: "Process, decision, data, subprocess and BPMN events, tasks and gateways.",
  },
  {
    id: "network",
    name: "Network topology",
    description: "Routers, switches, firewalls, servers, clouds and subnets.",
  },
  {
    id: "wireframe",
    name: "User flow / wireframe",
    description: "Browser and phone frames, buttons, inputs, cards, navigation and modals.",
  },
  {
    id: "dfd",
    name: "Data flow",
    description: "External entities, processes, data stores and labelled flows.",
  },
];

export interface KitItem {
  id: string;
  name: string;
  kit: KitId;
  description: string;
  keywords: string[];
  build: (style?: StyleCtx) => Promise<BuiltItem>;
}

const fin = (b: Builder, id: string) => b.finish({ kind: "kit", id });

const BLUE = "#a5d8ff";
const GREEN = "#b2f2bb";
const YELLOW = "#ffec99";
const GRAY = "#e9ecef";
const MUTED = "#868e96";

function kit(
  kitId: KitId,
  id: string,
  name: string,
  description: string,
  keywords: string[],
  fn: (b: Builder) => void | Promise<void>,
): KitItem {
  return {
    id,
    name,
    kit: kitId,
    description,
    keywords,
    build: async (style = DEFAULT_STYLE) => {
      const b = new Builder(style);
      await fn(b);
      return fin(b, id);
    },
  };
}

export const KIT_ITEMS: KitItem[] = [
  // ───────────── UML ─────────────
  kit(
    "uml",
    "uml-class",
    "Class",
    "Three-compartment class box.",
    ["class", "attributes", "methods"],
    (b) => {
      b.box(0, 0, 200, 150, undefined, { round: false, bg: "#fff9db" });
      b.text(0, 8, "ClassName", { size: 18, align: "center" });
      b.line(0, 38, [
        [0, 0],
        [200, 0],
      ]);
      b.text(10, 46, "- id: UUID\n- name: string", { size: 14 });
      b.line(0, 98, [
        [0, 0],
        [200, 0],
      ]);
      b.text(10, 106, "+ save(): void\n+ find(id): Class", { size: 14 });
    },
  ),
  kit(
    "uml",
    "uml-interface",
    "Interface",
    "Interface with stereotype.",
    ["interface", "contract"],
    (b) => {
      b.box(0, 0, 200, 130, undefined, { round: false, bg: "#e7f5ff" });
      b.text(0, 6, "«interface»", { size: 13, align: "center", stroke: MUTED });
      b.text(0, 24, "Repository", { size: 18, align: "center" });
      b.line(0, 54, [
        [0, 0],
        [200, 0],
      ]);
      b.text(10, 62, "+ get(id): Entity\n+ put(e: Entity)", { size: 14 });
    },
  ),
  kit(
    "uml",
    "uml-actor",
    "Actor",
    "Stick-figure actor for use-case diagrams.",
    ["actor", "user", "use case"],
    (b) => {
      b.ellipse(18, 0, 24, 24);
      b.line(30, 24, [
        [0, 0],
        [0, 40],
      ]);
      b.line(8, 34, [
        [0, 0],
        [44, 0],
      ]);
      b.line(30, 64, [
        [0, 0],
        [-20, 30],
      ]);
      b.line(30, 64, [
        [0, 0],
        [20, 30],
      ]);
      b.text(0, 100, "Actor", { size: 16, align: "center" });
    },
  ),
  kit("uml", "uml-usecase", "Use case", "Oval use case.", ["use case", "ellipse"], (b) => {
    b.ellipse(0, 0, 200, 80, "Use case", { bg: GREEN });
  }),
  kit(
    "uml",
    "uml-package",
    "Package",
    "Package with name tab.",
    ["package", "namespace", "module"],
    (b) => {
      b.box(0, 0, 80, 28, "pkg", { round: false, bg: GRAY, font: 14 });
      b.box(0, 28, 220, 130, undefined, { round: false });
    },
  ),
  kit(
    "uml",
    "uml-component",
    "Component",
    "Component with provided/required ports.",
    ["component", "module"],
    (b) => {
      b.box(10, 0, 190, 90, "«component»\nPayments", { bg: BLUE, font: 15 });
      b.box(0, 18, 24, 14, undefined, { round: false, bg: BLUE, strokeWidth: 1 });
      b.box(0, 52, 24, 14, undefined, { round: false, bg: BLUE, strokeWidth: 1 });
    },
  ),
  kit("uml", "uml-state", "State", "State with entry action.", ["state", "state machine"], (b) => {
    b.box(0, 0, 180, 90, undefined, { bg: YELLOW });
    b.text(0, 8, "Processing", { size: 17, align: "center" });
    b.line(
      0,
      38,
      [
        [0, 0],
        [180, 0],
      ],
      { strokeWidth: 1 },
    );
    b.text(10, 48, "entry / start()\nexit / stop()", { size: 13 });
  }),
  kit("uml", "uml-initial", "Initial state", "Filled start node.", ["start", "initial"], (b) => {
    b.ellipse(0, 0, 28, 28, undefined, { bg: "#1e1e1e" });
  }),
  kit("uml", "uml-final", "Final state", "Bullseye end node.", ["end", "final"], (b) => {
    b.ellipse(0, 0, 36, 36);
    b.ellipse(8, 8, 20, 20, undefined, { bg: "#1e1e1e" });
  }),
  kit("uml", "uml-action", "Activity", "Rounded activity/action.", ["activity", "action"], (b) => {
    b.box(0, 0, 160, 56, "Validate order", { bg: GREEN, round: "pill" });
  }),
  kit(
    "uml",
    "uml-decision",
    "Decision",
    "Branching diamond.",
    ["decision", "gateway", "branch"],
    (b) => {
      b.diamond(0, 0, 110, 90, "?", { bg: YELLOW });
    },
  ),
  kit(
    "uml",
    "uml-fork",
    "Fork / join",
    "Synchronisation bar.",
    ["fork", "join", "parallel"],
    (b) => {
      b.box(0, 0, 160, 10, undefined, { bg: "#1e1e1e", round: false });
    },
  ),

  // ───────────── Sequence ─────────────
  kit(
    "sequence",
    "seq-lifeline",
    "Lifeline",
    "Participant with dashed lifeline and activation bar.",
    ["lifeline", "participant", "object"],
    (b) => {
      b.box(0, 0, 130, 48, "Service", { bg: BLUE });
      b.line(
        65,
        48,
        [
          [0, 0],
          [0, 320],
        ],
        { dashed: true, strokeWidth: 1 },
      );
      b.box(59, 90, 12, 110, undefined, { bg: GRAY, round: false, strokeWidth: 1 });
    },
  ),
  kit(
    "sequence",
    "seq-message",
    "Message",
    "Synchronous call.",
    ["message", "call", "sync"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [220, 0],
        ],
        { label: "request()" },
      );
    },
  ),
  kit(
    "sequence",
    "seq-return",
    "Return",
    "Dashed return message.",
    ["return", "response", "reply"],
    (b) => {
      b.arrow(
        220,
        0,
        [
          [0, 0],
          [-220, 0],
        ],
        { label: "response", dashed: true },
      );
    },
  ),
  kit(
    "sequence",
    "seq-async",
    "Async message",
    "Open-arrow asynchronous message.",
    ["async", "event", "fire and forget"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [220, 0],
        ],
        { label: "publish(event)", end: "bar" },
      );
    },
  ),
  kit(
    "sequence",
    "seq-self",
    "Self-call",
    "Message from a participant to itself.",
    ["self", "recursive", "loop"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [60, 0],
          [60, 36],
          [0, 36],
        ],
        { label: "validate()" },
      );
    },
  ),
  kit(
    "sequence",
    "seq-fragment",
    "Fragment (alt/loop)",
    "Combined fragment frame with guard and divider.",
    ["alt", "opt", "loop", "fragment", "frame"],
    (b) => {
      b.box(0, 0, 300, 170, undefined, { round: false });
      b.box(0, 0, 60, 24, "alt", { round: false, bg: GRAY, font: 14, strokeWidth: 1 });
      b.text(70, 4, "[success]", { size: 13, stroke: MUTED });
      b.line(
        0,
        90,
        [
          [0, 0],
          [300, 0],
        ],
        { dashed: true, strokeWidth: 1 },
      );
      b.text(10, 96, "[else]", { size: 13, stroke: MUTED });
    },
  ),

  // ───────────── ERD ─────────────
  kit(
    "erd",
    "erd-entity",
    "Entity",
    "Table with key columns.",
    ["entity", "table", "schema"],
    (b) => {
      b.box(0, 0, 200, 36, "users", { bg: "#d0bfff", round: false });
      b.box(0, 36, 200, 104, undefined, { round: false });
      b.text(
        10,
        44,
        "PK  id            uuid\n    email         text\n    name          text\nFK  org_id        uuid",
        { size: 13 },
      );
    },
  ),
  kit(
    "erd",
    "erd-one-one",
    "One to one",
    "Exactly-one on both ends.",
    ["1:1", "one to one", "crow", "crowfoot"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [200, 0],
        ],
        { start: "crowfoot_one", end: "crowfoot_one" },
      );
    },
  ),
  kit(
    "erd",
    "erd-one-many",
    "One to many",
    "One to zero-or-many.",
    ["1:n", "one to many", "crow", "crowfoot"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [200, 0],
        ],
        { start: "crowfoot_one", end: "crowfoot_many" },
      );
    },
  ),
  kit(
    "erd",
    "erd-many-many",
    "Many to many",
    "Many on both ends.",
    ["n:m", "many to many", "join", "crow", "crowfoot"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [200, 0],
        ],
        { start: "crowfoot_many", end: "crowfoot_many" },
      );
    },
  ),
  kit(
    "erd",
    "erd-one-or-many",
    "One-or-many",
    "At least one.",
    ["mandatory", "one or many", "crow", "crowfoot"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [200, 0],
        ],
        { start: "crowfoot_one", end: "crowfoot_one_or_many" },
      );
    },
  ),

  // ───────────── C4 ─────────────
  ...(
    [
      [
        "c4-person",
        "Person",
        "Name\n[Person]\n\nA user of the system.",
        "#08427b",
        "#ffffff",
        "person",
        "user",
      ],
      [
        "c4-system",
        "Software system",
        "System\n[Software System]\n\nWhat it does.",
        "#1168bd",
        "#ffffff",
        "system",
        "software system",
      ],
      [
        "c4-container",
        "Container",
        "Container\n[Technology]\n\nWhat it does.",
        "#438dd5",
        "#ffffff",
        "container",
        "app",
      ],
      [
        "c4-component",
        "Component",
        "Component\n[Technology]\n\nWhat it does.",
        "#85bbf0",
        "#0b2540",
        "component",
        "module",
      ],
      [
        "c4-external",
        "External system",
        "External system\n[Software System]\n\nOutside our scope.",
        "#999999",
        "#ffffff",
        "external",
        "third party",
      ],
    ] as const
  ).map(([id, name, label, bg, fg, ...kw]) =>
    kit("c4", id, name, `C4 ${name.toLowerCase()} box.`, [...kw], (b) => {
      b.box(0, 0, 220, 130, label, { bg, stroke: bg, labelColor: fg, font: 15 });
    }),
  ),
  kit(
    "c4",
    "c4-boundary",
    "Boundary",
    "Dashed system/container boundary.",
    ["boundary", "scope"],
    (b) => {
      b.box(0, 0, 520, 320, "System name\n[Software System]", {
        dashed: true,
        align: "left",
        valign: "top",
        stroke: MUTED,
        round: true,
      });
    },
  ),
  kit(
    "c4",
    "c4-relationship",
    "Relationship",
    "Labelled uses-relationship.",
    ["relationship", "uses", "dependency"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [240, 0],
        ],
        { label: "Uses\n[HTTPS/JSON]", dashed: true, stroke: MUTED },
      );
    },
  ),

  // ───────────── Flowchart / BPMN-lite ─────────────
  kit(
    "flowchart",
    "flow-terminator",
    "Start / end",
    "Terminator.",
    ["start", "end", "terminator"],
    (b) => {
      b.box(0, 0, 150, 52, "Start", { round: "pill", bg: GREEN });
    },
  ),
  kit(
    "flowchart",
    "flow-process",
    "Process",
    "Process step.",
    ["process", "step", "action"],
    (b) => {
      b.box(0, 0, 160, 64, "Process", { bg: BLUE, round: false });
    },
  ),
  kit(
    "flowchart",
    "flow-decision",
    "Decision",
    "Yes/no branch.",
    ["decision", "if", "branch"],
    (b) => {
      b.diamond(0, 0, 160, 110, "Condition?", { bg: YELLOW });
    },
  ),
  kit(
    "flowchart",
    "flow-data",
    "Data / I/O",
    "Parallelogram input/output.",
    ["data", "input", "output", "io"],
    (b) => {
      b.polygon(
        0,
        0,
        [
          [24, 0],
          [180, 0],
          [156, 60],
          [0, 60],
        ],
        { bg: "#ffd8a8" },
      );
      b.text(46, 20, "Input / output", { size: 15 });
    },
  ),
  kit(
    "flowchart",
    "flow-subprocess",
    "Subprocess",
    "Predefined process.",
    ["subprocess", "predefined"],
    (b) => {
      b.box(0, 0, 170, 64, "Subprocess", { bg: BLUE, round: false });
      b.line(
        14,
        0,
        [
          [0, 0],
          [0, 64],
        ],
        { strokeWidth: 1 },
      );
      b.line(
        156,
        0,
        [
          [0, 0],
          [0, 64],
        ],
        { strokeWidth: 1 },
      );
    },
  ),
  kit(
    "flowchart",
    "bpmn-start",
    "BPMN start event",
    "Thin circle.",
    ["bpmn", "event", "start"],
    (b) => {
      b.ellipse(0, 0, 44, 44, undefined, { bg: GREEN });
      b.text(0, 52, "Start", { size: 14, align: "center" });
    },
  ),
  kit("flowchart", "bpmn-end", "BPMN end event", "Thick circle.", ["bpmn", "event", "end"], (b) => {
    b.ellipse(0, 0, 44, 44, undefined, { bg: "#ffc9c9", strokeWidth: 5 });
    b.text(4, 52, "End", { size: 14, align: "center" });
  }),
  kit("flowchart", "bpmn-task", "BPMN task", "Rounded task.", ["bpmn", "task", "activity"], (b) => {
    b.box(0, 0, 150, 76, "Task", { bg: BLUE });
  }),
  kit(
    "flowchart",
    "bpmn-gateway",
    "BPMN gateway",
    "Exclusive gateway.",
    ["bpmn", "gateway", "xor"],
    (b) => {
      b.diamond(0, 0, 70, 70, "×", { bg: YELLOW, font: 22 });
    },
  ),
  kit(
    "flowchart",
    "bpmn-lane",
    "Pool / lane",
    "Swim-lane with header.",
    ["bpmn", "lane", "pool", "swimlane"],
    (b) => {
      b.box(0, 0, 640, 180, undefined, { round: false });
      b.box(0, 0, 640, 32, "Lane name", { round: false, bg: GRAY, font: 15 });
    },
  ),

  // ───────────── Network ─────────────
  ...(
    [
      ["net-router", "Router", "mdi:router-network", "router", "gateway"],
      ["net-switch", "Switch", "mdi:switch", "switch", "layer 2"],
      ["net-firewall", "Firewall", "carbon:firewall", "firewall", "security"],
      ["net-server", "Server", "mdi:server", "server", "host"],
      ["net-cloud", "Cloud / Internet", "mdi:cloud-outline", "internet", "wan"],
      ["net-laptop", "Workstation", "mdi:laptop", "laptop", "client"],
      ["net-ap", "Access point", "mdi:access-point", "wifi", "wireless"],
      ["net-printer", "Printer", "mdi:printer", "printer", "device"],
    ] as const
  ).map(([id, name, icon, ...kw]) =>
    kit("network", id, name, `${name} icon with label.`, [...kw], async (b) => {
      await b.icon(icon, 20, 0, 64);
      b.text(0, 74, name, { size: 15, align: "center" });
    }),
  ),
  kit(
    "network",
    "net-subnet",
    "Subnet / zone",
    "Dashed network zone.",
    ["subnet", "zone", "dmz", "vlan"],
    (b) => {
      b.box(0, 0, 360, 220, "10.0.1.0/24", {
        dashed: true,
        align: "left",
        valign: "top",
        stroke: MUTED,
      });
    },
  ),
  kit(
    "network",
    "net-link",
    "Link",
    "Network connection without arrowheads.",
    ["link", "cable", "connection"],
    (b) => {
      b.arrow(
        0,
        0,
        [
          [0, 0],
          [200, 0],
        ],
        { start: null, end: null, label: "1 Gbps" },
      );
    },
  ),

  // ───────────── Wireframe ─────────────
  kit(
    "wireframe",
    "wf-browser",
    "Browser window",
    "Window chrome with address bar.",
    ["browser", "window", "page", "screen"],
    (b) => {
      b.box(0, 0, 520, 340, undefined, { round: true });
      b.line(
        0,
        40,
        [
          [0, 0],
          [520, 0],
        ],
        { strokeWidth: 1 },
      );
      b.ellipse(14, 14, 12, 12, undefined, { bg: "#ffc9c9", strokeWidth: 1 });
      b.ellipse(34, 14, 12, 12, undefined, { bg: YELLOW, strokeWidth: 1 });
      b.ellipse(54, 14, 12, 12, undefined, { bg: GREEN, strokeWidth: 1 });
      b.box(86, 8, 400, 24, "https://example.com", {
        round: "pill",
        bg: GRAY,
        font: 12,
        strokeWidth: 1,
        stroke: MUTED,
      });
    },
  ),
  kit(
    "wireframe",
    "wf-phone",
    "Phone screen",
    "Mobile device frame.",
    ["phone", "mobile", "screen"],
    (b) => {
      b.box(0, 0, 230, 440, undefined, { round: true, strokeWidth: 3 });
      b.box(80, 12, 70, 8, undefined, { round: "pill", bg: "#1e1e1e", strokeWidth: 1 });
      b.box(85, 420, 60, 6, undefined, { round: "pill", bg: MUTED, stroke: MUTED, strokeWidth: 1 });
    },
  ),
  kit("wireframe", "wf-button", "Button", "Primary button.", ["button", "cta"], (b) => {
    b.box(0, 0, 130, 42, "Button", { bg: BLUE, stroke: "#1971c2", font: 16 });
  }),
  kit(
    "wireframe",
    "wf-input",
    "Text input",
    "Input with placeholder.",
    ["input", "field", "form", "textbox"],
    (b) => {
      b.box(0, 0, 240, 38, undefined, { round: true, strokeWidth: 1 });
      b.text(12, 9, "Placeholder", { size: 15, stroke: MUTED });
    },
  ),
  kit(
    "wireframe",
    "wf-checkbox",
    "Checkbox",
    "Checked checkbox with label.",
    ["checkbox", "form", "option"],
    (b) => {
      b.box(0, 0, 22, 22, undefined, { round: false, strokeWidth: 1 });
      b.line(5, 11, [
        [0, 0],
        [5, 6],
        [12, -8],
      ]);
      b.text(34, 1, "Remember me", { size: 16 });
    },
  ),
  kit(
    "wireframe",
    "wf-radio",
    "Radio button",
    "Selected radio with label.",
    ["radio", "form", "option"],
    (b) => {
      b.ellipse(0, 0, 22, 22, undefined, { strokeWidth: 1 });
      b.ellipse(6, 6, 10, 10, undefined, { bg: "#1e1e1e", strokeWidth: 1 });
      b.text(34, 1, "Option", { size: 16 });
    },
  ),
  kit(
    "wireframe",
    "wf-navbar",
    "Navigation bar",
    "Top navigation.",
    ["nav", "navbar", "header", "menu"],
    (b) => {
      b.box(0, 0, 520, 48, undefined, { round: false, bg: GRAY });
      b.text(16, 13, "Logo", { size: 18 });
      b.text(200, 15, "Home    Pricing    Docs    Login", { size: 15 });
    },
  ),
  kit(
    "wireframe",
    "wf-card",
    "Card",
    "Image, title and text.",
    ["card", "tile", "listing"],
    (b) => {
      b.box(0, 0, 220, 260, undefined, { round: true });
      b.box(0, 0, 220, 130, undefined, { round: false, bg: GRAY, strokeWidth: 1 });
      b.line(0, 0, [[220, 130]], { strokeWidth: 1, stroke: MUTED });
      b.line(0, 130, [[220, -130]], { strokeWidth: 1, stroke: MUTED });
      b.text(14, 144, "Card title", { size: 18 });
      b.line(
        14,
        184,
        [
          [0, 0],
          [190, 0],
        ],
        { strokeWidth: 3, stroke: "#ced4da" },
      );
      b.line(
        14,
        204,
        [
          [0, 0],
          [150, 0],
        ],
        { strokeWidth: 3, stroke: "#ced4da" },
      );
      b.box(14, 220, 90, 28, "Action", { bg: BLUE, font: 13, strokeWidth: 1 });
    },
  ),
  kit(
    "wireframe",
    "wf-image",
    "Image placeholder",
    "Box with a cross.",
    ["image", "photo", "placeholder"],
    (b) => {
      b.box(0, 0, 200, 140, undefined, { round: false, bg: GRAY });
      b.line(0, 0, [[200, 140]], { strokeWidth: 1, stroke: MUTED });
      b.line(0, 140, [[200, -140]], { strokeWidth: 1, stroke: MUTED });
    },
  ),
  kit(
    "wireframe",
    "wf-modal",
    "Modal dialog",
    "Dialog with actions.",
    ["modal", "dialog", "popup"],
    (b) => {
      b.box(0, 0, 340, 210, undefined, { round: true, bg: "#ffffff" });
      b.text(18, 16, "Dialog title", { size: 20 });
      b.text(310, 12, "×", { size: 24 });
      b.line(
        0,
        54,
        [
          [0, 0],
          [340, 0],
        ],
        { strokeWidth: 1 },
      );
      b.text(18, 72, "Are you sure you want to continue?", { size: 15, stroke: MUTED });
      b.box(130, 150, 90, 38, "Cancel", { font: 14, strokeWidth: 1 });
      b.box(232, 150, 90, 38, "Confirm", { bg: BLUE, font: 14, strokeWidth: 1, stroke: "#1971c2" });
    },
  ),
  kit(
    "wireframe",
    "wf-avatar",
    "Avatar",
    "Circular avatar with name.",
    ["avatar", "profile", "user"],
    (b) => {
      b.ellipse(0, 0, 64, 64, undefined, { bg: GRAY });
      b.ellipse(22, 12, 20, 20, undefined, { strokeWidth: 1 });
      b.line(
        12,
        58,
        [
          [0, 0],
          [8, -14],
          [32, -14],
          [40, 0],
        ],
        { strokeWidth: 1 },
      );
      b.text(76, 20, "Jane Doe", { size: 17 });
    },
  ),
  kit(
    "wireframe",
    "wf-decision",
    "Flow decision",
    "User-flow decision point.",
    ["flow", "decision", "branch"],
    (b) => {
      b.diamond(0, 0, 170, 110, "Logged in?", { bg: YELLOW });
    },
  ),

  // ───────────── Data flow ─────────────
  kit(
    "dfd",
    "dfd-external",
    "External entity",
    "Source or sink outside the system.",
    ["external", "entity", "terminator"],
    (b) => {
      b.box(0, 0, 160, 64, "Customer", { bg: GRAY, round: false });
    },
  ),
  kit(
    "dfd",
    "dfd-process",
    "Process",
    "Numbered process bubble.",
    ["process", "transform"],
    (b) => {
      b.ellipse(0, 0, 160, 100, "1.0\nProcess order", { bg: BLUE });
    },
  ),
  kit(
    "dfd",
    "dfd-store",
    "Data store",
    "Open-ended store.",
    ["store", "database", "datastore"],
    (b) => {
      b.line(0, 0, [[200, 0]], { strokeWidth: 2 });
      b.line(0, 54, [[200, 0]], { strokeWidth: 2 });
      b.line(0, 0, [[0, 54]], { strokeWidth: 2 });
      b.text(14, 16, "D1  Orders", { size: 17 });
    },
  ),
  kit("dfd", "dfd-flow", "Data flow", "Labelled flow.", ["flow", "arrow", "data"], (b) => {
    b.arrow(
      0,
      0,
      [
        [0, 0],
        [220, 0],
      ],
      { label: "order details" },
    );
  }),
];

export function searchKits(query: string, kitId?: KitId): KitItem[] {
  const q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return KIT_ITEMS.filter(
    (x) =>
      (!kitId || x.kit === kitId) &&
      q.every((t) =>
        `${x.name} ${x.kit} ${x.description} ${x.keywords.join(" ")}`.toLowerCase().includes(t),
      ),
  );
}
