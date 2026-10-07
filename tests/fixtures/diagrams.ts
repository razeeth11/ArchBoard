/** Deterministic reference diagrams: fixed seeds/ids so exports are byte-stable across runs. */
const CH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
let counter = 0;

type Base = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  bg?: string;
  frameId?: string | null;
  roughness?: number;
};

function base(type: string, b: Base) {
  const i = counter++;
  return {
    id: b.id,
    type,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    angle: 0,
    strokeColor: b.stroke ?? "#1e1e1e",
    backgroundColor: b.bg ?? "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: b.roughness ?? 1,
    opacity: 100,
    groupIds: [] as string[],
    frameId: b.frameId ?? null,
    roundness:
      type === "rectangle"
        ? { type: 3 }
        : type === "ellipse" || type === "diamond"
          ? { type: 2 }
          : null,
    seed: 1000 + i * 7,
    version: 1,
    versionNonce: 5000 + i,
    isDeleted: false,
    boundElements: null as unknown,
    updated: 1,
    link: null,
    locked: false,
    index: `a${CH[i % CH.length]}`,
  };
}

export const rect = (b: Base) => base("rectangle", b);
export const ellipse = (b: Base) => base("ellipse", b);
export const diamond = (b: Base) => base("diamond", b);
export const frame = (b: Base & { name: string }) => ({
  ...base("frame", b),
  name: b.name,
  roundness: null,
});

export function text(b: Base & { text: string; size?: number; family?: number; align?: string }) {
  const size = b.size ?? 20;
  return {
    ...base("text", b),
    roundness: null,
    text: b.text,
    originalText: b.text,
    fontSize: size,
    fontFamily: b.family ?? 5,
    textAlign: b.align ?? "left",
    verticalAlign: "top",
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
  };
}

export function arrow(b: Base & { points: [number, number][] }) {
  return {
    ...base("arrow", b),
    roundness: { type: 2 },
    points: b.points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };
}

export function line(b: Base & { points: [number, number][] }) {
  return { ...arrow(b), type: "line", endArrowhead: null, polygon: false };
}

export type Diagram = { name: string; elements: unknown[] };

export function diagrams(): Diagram[] {
  counter = 0;
  const out: Diagram[] = [];

  counter = 0;
  out.push({
    name: "client-server",
    elements: [
      rect({ id: "c", x: 40, y: 60, width: 160, height: 80, bg: "#a5d8ff" }),
      text({ id: "ct", x: 70, y: 86, width: 100, height: 25, text: "Client" }),
      rect({ id: "s", x: 360, y: 60, width: 160, height: 80, bg: "#b2f2bb" }),
      text({ id: "st", x: 390, y: 86, width: 100, height: 25, text: "Server" }),
      arrow({
        id: "a1",
        x: 200,
        y: 100,
        width: 160,
        height: 0,
        points: [
          [0, 0],
          [160, 0],
        ],
      }),
    ],
  });

  counter = 0;
  out.push({
    name: "shapes",
    elements: [
      ellipse({ id: "e", x: 20, y: 20, width: 140, height: 90, bg: "#ffec99" }),
      diamond({ id: "d", x: 200, y: 10, width: 140, height: 110, bg: "#ffc9c9" }),
      rect({ id: "r", x: 380, y: 20, width: 140, height: 90, bg: "#d0bfff" }),
    ],
  });

  counter = 0;
  out.push({
    name: "text-fonts",
    elements: [
      text({
        id: "t1",
        x: 20,
        y: 20,
        width: 330,
        height: 25,
        text: "Excalifont: Orders API",
        family: 5,
      }),
      text({
        id: "t2",
        x: 20,
        y: 70,
        width: 330,
        height: 25,
        text: "Nunito: Orders API",
        family: 6,
      }),
      text({
        id: "t3",
        x: 20,
        y: 120,
        width: 330,
        height: 25,
        text: "Comic Shanns: Orders API",
        family: 8,
      }),
    ],
  });

  counter = 0;
  out.push({
    name: "sketchy-vs-clean",
    elements: [
      rect({ id: "k1", x: 20, y: 20, width: 140, height: 90, roughness: 2, bg: "#ffd8a8" }),
      rect({ id: "k2", x: 200, y: 20, width: 140, height: 90, roughness: 0, bg: "#ffd8a8" }),
      line({
        id: "l1",
        x: 20,
        y: 160,
        width: 320,
        height: 40,
        points: [
          [0, 0],
          [160, 40],
          [320, 0],
        ],
      }),
    ],
  });

  counter = 0;
  out.push({
    name: "framed-slides",
    elements: [
      frame({ id: "f1", x: 0, y: 0, width: 300, height: 200, name: "Context" }),
      rect({ id: "f1r", x: 30, y: 40, width: 120, height: 70, bg: "#a5d8ff", frameId: "f1" }),
      frame({ id: "f2", x: 360, y: 0, width: 300, height: 200, name: "Containers" }),
      ellipse({ id: "f2e", x: 400, y: 40, width: 140, height: 90, bg: "#b2f2bb", frameId: "f2" }),
    ],
  });
  return out;
}
