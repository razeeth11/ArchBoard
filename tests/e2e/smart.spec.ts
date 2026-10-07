import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import { arrow, rect, text } from "../fixtures/diagrams";
import { chooseOption, downloadExport, openExport } from "./export-helpers";
import { apiReady, elementCount, openEditor, waitSaved } from "./helpers";

const panel = (page: Page) => page.getByRole("complementary", { name: "Components" });
const inspector = (page: Page) => page.getByTestId("smart-inspector");
const item = (page: Page, id: string) => panel(page).locator(`[data-smart-id="${id}"]`);

interface Snap {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isDeleted: boolean;
  role?: string;
  instance?: string;
  text?: string;
  bg: string;
  stroke: string;
  version?: number;
  props?: Record<string, unknown>;
  def?: unknown;
  containerId?: string | null;
  bound: string[];
  sb?: string | null;
  eb?: string | null;
  points?: number[][];
  groupIds: string[];
}

const snap = (page: Page, includeDeleted = false): Promise<Snap[]> =>
  page.evaluate((withDeleted) => {
    const api = window.__archboard!.api;
    const els = withDeleted ? api.getSceneElementsIncludingDeleted() : api.getSceneElements();
    return els.map((e) => {
      const any = e as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const m = any.customData?.smartComponent;
      return {
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        w: e.width,
        h: e.height,
        isDeleted: e.isDeleted,
        role: m?.role,
        instance: m?.instance,
        text: any.text,
        bg: any.backgroundColor,
        stroke: any.strokeColor,
        version: m?.version,
        props: m?.props,
        def: m?.def,
        containerId: any.containerId,
        bound: (any.boundElements ?? []).map((b: { id: string }) => b.id),
        sb: any.startBinding?.elementId ?? null,
        eb: any.endBinding?.elementId ?? null,
        points: any.points,
        groupIds: any.groupIds,
      };
    });
  }, includeDeleted);

const roles = (s: Snap[]) => s.filter((e) => e.role && !e.role.includes(":")).map((e) => e.role!);
const byRole = (s: Snap[], role: string) => s.find((e) => e.role === role)!;
const countRole = (s: Snap[], re: RegExp) => roles(s).filter((r) => re.test(r)).length;

/** Select every element that belongs to the (first) smart component instance, like clicking its group. */
const selectInstance = (page: Page, extra: string[] = []) =>
  page.evaluate((more) => {
    const api = window.__archboard!.api;
    const els = api.getSceneElements();
    const inst = (
      els.find((e) => (e.customData as { smartComponent?: unknown } | undefined)?.smartComponent)
        ?.customData as { smartComponent: { instance: string } }
    ).smartComponent.instance;
    const ids = els
      .filter(
        (e) =>
          (e.customData as { smartComponent?: { instance: string } } | undefined)?.smartComponent
            ?.instance === inst,
      )
      .map((e) => e.id);
    api.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries([...ids, ...more].map((i) => [i, true])),
      } as never,
    });
  }, extra);

const putElements = (
  page: Page,
  add: unknown[],
  patch: Record<string, Record<string, unknown>> = {},
) =>
  page.evaluate(
    ({ add, patch }) => {
      const api = window.__archboard!.api;
      const cur = api
        .getSceneElementsIncludingDeleted()
        .map((e) => (patch[e.id] ? { ...e, ...patch[e.id], version: e.version + 1 } : e));
      api.updateScene({ elements: [...cur, ...add] as never });
    },
    { add, patch },
  );

async function insert(page: Page, id: string) {
  await item(page, id).click();
  await expect(inspector(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await expect(panel(page).getByRole("tab", { name: "Smart" })).toHaveAttribute(
    "data-state",
    "active",
  );
});

test("ships 15+ components, each inserting as a stable-id group with metadata and a properties panel", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const ids = await panel(page)
    .locator("[data-smart-id]")
    .evaluateAll((xs) => xs.map((x) => x.getAttribute("data-smart-id")!));
  expect(ids.length).toBeGreaterThanOrEqual(15);
  for (const id of ids) {
    await item(page, id).click();
    await expect(inspector(page)).toContainText(/v1/);
  }
  const s = await snap(page);
  const instances = new Set(s.map((e) => e.instance).filter(Boolean));
  expect(instances.size).toBe(ids.length);
  // every element of every instance carries {id, version, instance, role, props}
  for (const e of s.filter((x) => x.instance)) {
    expect(e.role, e.id).toBeTruthy();
    expect(e.props, e.id).toBeTruthy();
    expect(e.id.startsWith(`sc_${e.instance}_`), e.id).toBe(true);
  }
  await waitSaved(page);
});

test("every component regenerates cleanly when its first property is changed", async ({ page }) => {
  test.setTimeout(240_000);
  const ids = await panel(page)
    .locator("[data-smart-id]")
    .evaluateAll((xs) => xs.map((x) => x.getAttribute("data-smart-id")!));
  for (const id of ids) {
    await item(page, id).click();
    await expect(inspector(page)).toBeVisible();
    const before = (await snap(page)).filter((e) => e.role);
    const inc = inspector(page)
      .getByRole("button", { name: /^Increase/ })
      .first();
    const box = inspector(page).getByRole("checkbox").first();
    const select = inspector(page).getByRole("combobox").first();
    if (await inc.count()) await inc.click();
    else if (await box.count()) await box.click();
    else await select.selectOption({ index: 1 });
    await expect(inspector(page)).not.toContainText("updating");
    const after = (await snap(page)).filter((e) => e.role);
    expect(after.length, id).toBeGreaterThan(0);
    expect(new Set(after.map((e) => e.id)).size, `${id}: ids stay unique`).toBe(after.length);
    expect(before.length).toBeGreaterThan(0);
    // clear the canvas for the next one
    await page.evaluate(() => window.__archboard!.api.updateScene({ elements: [] }));
  }
});

test("changing a property regenerates in place: same position, undoable", async ({ page }) => {
  await insert(page, "load-balanced-service");
  let s = await snap(page);
  expect(countRole(s, /^replica-\d+$/)).toBe(3);
  const root = byRole(s, "root");

  await inspector(page).getByRole("button", { name: "Increase Replicas" }).click();
  await inspector(page).getByRole("button", { name: "Increase Replicas" }).click();
  await expect.poll(async () => countRole(await snap(page), /^replica-\d+$/)).toBe(5);
  s = await snap(page);
  expect(byRole(s, "root").x).toBe(root.x);
  expect(byRole(s, "root").y).toBe(root.y);
  expect(byRole(s, "root").h).toBeGreaterThan(root.h); // frame grew with the content
  // ids of existing parts are unchanged; new parts were added
  for (const r of ["lb", "replica-1", "replica-2", "replica-3"])
    expect(byRole(s, r).id).toBe(`sc_${root.instance}_${r}`);

  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => countRole(await snap(page), /^replica-\d+$/)).toBe(3);
});

test("select, toggle and text properties update the diagram", async ({ page }) => {
  await insert(page, "load-balanced-service");
  await inspector(page).getByLabel("Load balancer").selectOption("L4");
  await expect
    .poll(
      async () =>
        (await snap(page)).find((e) => e.type === "text" && e.text?.includes("load balancer"))
          ?.text,
    )
    .toBe("L4 load balancer");
  await inspector(page).getByLabel("Health checks").uncheck();
  await expect.poll(async () => roles(await snap(page)).includes("health")).toBe(false);
  await inspector(page).getByLabel("Service name").fill("Billing");
  await expect.poll(async () => (await snap(page)).some((e) => e.text === "Billing #1")).toBe(true);
});

test("keeps the position the user moved it to, and their colour and label edits", async ({
  page,
}) => {
  await insert(page, "load-balanced-service");
  let s = await snap(page);
  const inst = s.find((e) => e.instance)!.instance!;
  const before = byRole(s, "root");
  // The user drags the whole component, recolours replica 2 and renames its label.
  await page.evaluate(
    ({ inst }) => {
      const api = window.__archboard!.api;
      const next = api.getSceneElements().map((e) => {
        const m = (
          e.customData as { smartComponent?: { instance: string; role: string } } | undefined
        )?.smartComponent;
        if (m?.instance !== inst) return e;
        let patch: Record<string, unknown> = { x: e.x + 300, y: e.y + 200, version: e.version + 1 };
        if (m.role === "replica-2") patch = { ...patch, backgroundColor: "#ff00ff" };
        if (m.role === "replica-2:label")
          patch = { ...patch, text: "Primary", originalText: "Primary" };
        return { ...e, ...patch };
      });
      api.updateScene({ elements: next as never });
    },
    { inst },
  );
  await selectInstance(page);
  await inspector(page).getByRole("button", { name: "Increase Replicas" }).click();
  await inspector(page).getByLabel("Service name").fill("Billing");
  await expect.poll(async () => countRole(await snap(page), /^replica-\d+$/)).toBe(4);
  await expect.poll(async () => (await snap(page)).some((e) => e.text === "Billing #1")).toBe(true);
  s = await snap(page);
  expect(byRole(s, "root").x).toBe(before.x + 300);
  expect(byRole(s, "root").y).toBe(before.y + 200);
  expect(byRole(s, "replica-2").bg).toBe("#ff00ff"); // user colour survived
  expect(s.find((e) => e.role === "replica-2:label")!.text).toBe("Primary"); // user label survived
  expect(s.find((e) => e.role === "replica-1:label")!.text).toBe("Billing #1"); // untouched labels follow props
  expect(byRole(s, "replica-4").id).toContain("replica-4");
});

test("arrows from outside stay attached and follow the shape; removed parts unbind", async ({
  page,
}) => {
  await insert(page, "load-balanced-service");
  const s = await snap(page);
  const lb = byRole(s, "lb");
  const r3 = byRole(s, "replica-3");
  const mk = (id: string, target: Snap, x: number, y: number) => ({
    ...arrow({
      id,
      x,
      y,
      width: 60,
      height: 0,
      points: [
        [0, 0],
        [60, 0],
      ],
    }),
    endBinding: { elementId: target.id, focus: 0, gap: 8 },
    startBinding: null,
  });
  await putElements(
    page,
    [
      mk("ext-a", lb, lb.x - 120, lb.y + lb.h / 2),
      mk("ext-b", r3, r3.x + r3.w + 120, r3.y + r3.h / 2),
    ],
    {
      [lb.id]: {
        boundElements: [
          ...lb.bound.map((id) => ({ id, type: id.includes(":label") ? "text" : "arrow" })),
          { id: "ext-a", type: "arrow" },
        ],
      },
      [r3.id]: {
        boundElements: [
          ...r3.bound.map((id) => ({ id, type: "text" })),
          { id: "ext-b", type: "arrow" },
        ],
      },
    },
  );
  await selectInstance(page);

  await inspector(page).getByRole("button", { name: "Increase Replicas" }).click();
  await inspector(page).getByRole("button", { name: "Increase Replicas" }).click();
  await expect.poll(async () => countRole(await snap(page), /^replica-\d+$/)).toBe(5);
  let after = await snap(page);
  const a = after.find((e) => e.id === "ext-a")!;
  const lb2 = byRole(after, "lb");
  expect(a.eb).toBe(lb.id); // still bound
  expect(lb2.bound).toContain("ext-a"); // and the shape still knows about it
  const end = [a.x + a.points![1]![0]!, a.y + a.points![1]![1]!];
  expect(Math.abs(end[0]! - lb2.x)).toBeLessThan(16); // meets the shape's left edge
  expect(end[1]!).toBeGreaterThan(lb2.y - 16);
  expect(end[1]!).toBeLessThan(lb2.y + lb2.h + 16); // at the new vertical position of the shape
  expect(lb2.y).not.toBe(lb.y); // (the load balancer really did move)

  // Shrinking removes replica 3: the arrow attached to it is unbound, not left dangling to a ghost.
  await inspector(page).getByLabel("Replicas", { exact: true }).fill("2");
  await expect.poll(async () => countRole(await snap(page), /^replica-\d+$/)).toBe(2);
  after = await snap(page);
  expect(after.find((e) => e.id === "ext-b")!.eb).toBeNull();
  expect(after.find((e) => e.id === "ext-a")!.eb).toBe(lb.id);
});

test("ports: connect a selected shape to a named port with a bound arrow", async ({ page }) => {
  await insert(page, "load-balanced-service");
  await putElements(page, [rect({ id: "client-box", x: 100, y: 100, width: 120, height: 60 })]);
  await selectInstance(page, ["client-box"]);
  await expect(inspector(page).getByText("Connection ports")).toBeVisible();
  await expect(inspector(page).getByText("replica-2", { exact: true })).toBeVisible();
  await inspector(page).getByRole("button", { name: "Connect selected shape to port in" }).click();
  await expect
    .poll(async () => (await snap(page)).filter((e) => e.type === "arrow" && !e.role).length)
    .toBe(1);
  const s = await snap(page);
  const link = s.find((e) => e.type === "arrow" && !e.role)!;
  const lb = byRole(s, "lb");
  expect(link.sb).toBe("client-box");
  expect(link.eb).toBe(lb.id);
  expect(lb.bound).toContain(link.id);
  expect(s.find((e) => e.id === "client-box")!.bound).toContain(link.id);
});

test("detach turns it into plain shapes; a missing definition is handled gracefully", async ({
  page,
}) => {
  await insert(page, "cache-aside");
  await inspector(page).getByRole("button", { name: "Detach" }).click();
  await expect(inspector(page)).toBeHidden();
  let s = await snap(page);
  expect(s.length).toBeGreaterThan(5);
  expect(s.every((e) => !e.role)).toBe(true);

  await page.evaluate(() => window.__archboard!.api.updateScene({ elements: [] }));
  await insert(page, "circuit-breaker");
  await page.evaluate(() => {
    const api = window.__archboard!.api;
    api.updateScene({
      elements: api.getSceneElements().map((e) => ({
        ...e,
        customData: {
          smartComponent: {
            ...(e.customData as { smartComponent: object }).smartComponent,
            id: "ghost",
          },
        },
        version: e.version + 1,
      })) as never,
    });
  });
  await selectInstance(page);
  await expect(inspector(page)).toContainText("not installed");
  await inspector(page).getByRole("button", { name: "Convert to plain shapes" }).click();
  await expect(inspector(page)).toBeHidden();
  s = await snap(page);
  expect(s.every((e) => !e.role)).toBe(true);
});

test("an outdated instance offers an update", async ({ page }) => {
  await insert(page, "k8s-deployment");
  await page.evaluate(() => {
    const api = window.__archboard!.api;
    api.updateScene({
      elements: api.getSceneElements().map((e) => ({
        ...e,
        customData: {
          smartComponent: {
            ...(e.customData as { smartComponent: object }).smartComponent,
            version: 0,
          },
        },
        version: e.version + 1,
      })) as never,
    });
  });
  await selectInstance(page);
  await inspector(page)
    .getByRole("button", { name: /Update to v1/ })
    .click();
  await expect.poll(async () => (await snap(page)).find((e) => e.role === "root")?.version).toBe(1);
});

test("survives reload and can still be edited afterwards", async ({ page }) => {
  await insert(page, "queue-with-consumers");
  await waitSaved(page);
  const n = await elementCount(page);
  await page.reload();
  await expect.poll(() => elementCount(page)).toBe(n);
  await selectInstance(page);
  await expect(inspector(page)).toContainText("Queue with consumers");
  await inspector(page).getByRole("button", { name: "Increase Consumer groups" }).click();
  await expect.poll(async () => countRole(await snap(page), /^group-\d+$/)).toBe(3);
});

test("smart items can be dragged onto the canvas", async ({ page }) => {
  await item(page, "cache-aside").dragTo(page.getByTestId("editor-root"), {
    targetPosition: { x: 400, y: 350 },
  });
  await expect.poll(async () => roles(await snap(page)).includes("cache")).toBe(true);
});

test.describe("authoring", () => {
  const seed = async (page: Page) => {
    await putElements(page, [
      {
        ...rect({ id: "cr1", x: 300, y: 300, width: 140, height: 60, bg: "#d3f9d8" }),
        boundElements: [
          { id: "ct1", type: "text" },
          { id: "ca", type: "arrow" },
        ],
      },
      {
        ...text({ id: "ct1", x: 330, y: 318, width: 80, height: 25, text: "Worker" }),
        containerId: "cr1",
        textAlign: "center",
        verticalAlign: "middle",
      },
      {
        ...rect({ id: "cr2", x: 560, y: 300, width: 140, height: 60, bg: "#fff3bf" }),
        boundElements: [
          { id: "ct2", type: "text" },
          { id: "ca", type: "arrow" },
        ],
      },
      {
        ...text({ id: "ct2", x: 600, y: 318, width: 60, height: 25, text: "Queue" }),
        containerId: "cr2",
        textAlign: "center",
        verticalAlign: "middle",
      },
      {
        ...arrow({
          id: "ca",
          x: 440,
          y: 330,
          width: 120,
          height: 0,
          points: [
            [0, 0],
            [120, 0],
          ],
        }),
        startBinding: { elementId: "cr1", focus: 0, gap: 8 },
        endBinding: { elementId: "cr2", focus: 0, gap: 8 },
      },
    ]);
    await page.evaluate(() =>
      window.__archboard!.api.updateScene({
        appState: {
          selectedElementIds: { cr1: true, ct1: true, cr2: true, ct2: true, ca: true },
        } as never,
      }),
    );
  };

  test("create from selection: choose a label property and a repeating part, no code", async ({
    page,
  }) => {
    await apiReady(page);
    await seed(page);
    await panel(page).getByRole("button", { name: "Create from selection…" }).click();
    const dlg = page.getByRole("dialog", { name: "Create Smart Component from selection" });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByTestId("create-part")).toHaveCount(3);
    await dlg.getByLabel("Name", { exact: true }).fill("Job runner");
    await dlg.getByLabel("Make “Worker” a property").check();
    await dlg.getByLabel("Repeat Worker").check();
    await dlg.getByRole("button", { name: "Save component" }).click();
    await expect(dlg).toBeHidden();
    await expect(item(page, "job-runner")).toBeVisible();

    // Use it: insert, then change its properties.
    await page.evaluate(() => window.__archboard!.api.updateScene({ elements: [] }));
    await item(page, "job-runner").click();
    await expect(inspector(page)).toContainText("Job runner");
    await inspector(page).getByRole("button", { name: "Increase Count" }).click();
    await inspector(page).getByRole("button", { name: "Increase Count" }).click();
    await expect.poll(async () => countRole(await snap(page), /^worker-\d+$/)).toBe(3);
    await inspector(page).getByLabel("Worker", { exact: true }).fill("Job");
    await expect
      .poll(async () => (await snap(page)).filter((e) => e.text === "Job").length)
      .toBe(3);
    expect((await snap(page)).filter((e) => e.text === "Queue").length).toBe(1);
    // The arrow between them is bound by the same repeat index.
    const arrows = (await snap(page)).filter(
      (e) => e.type === "arrow" && e.role?.startsWith("arrow"),
    );
    expect(arrows.length).toBeGreaterThan(0);
  });

  test("custom definitions persist, export/import as JSON, and instances embed their definition", async ({
    page,
  }) => {
    await apiReady(page);
    await seed(page);
    await panel(page).getByRole("button", { name: "Create from selection…" }).click();
    const dlg = page.getByRole("dialog", { name: "Create Smart Component from selection" });
    await dlg.getByLabel("Name", { exact: true }).fill("Job runner");
    await dlg.getByLabel("Repeat Worker").check();
    await dlg.getByRole("button", { name: "Save component" }).click();
    await page.evaluate(() => window.__archboard!.api.updateScene({ elements: [] }));
    await item(page, "job-runner").click();
    await waitSaved(page);

    // Export the definition as a file.
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      panel(page).getByRole("button", { name: "Export Job runner" }).click(),
    ]);
    const def = JSON.parse(await readFile(await dl.path(), "utf8"));
    expect(def.schema).toBe("archboard.smart/1");
    expect(def.nodes.length).toBe(3);
    expect(def.params.map((p: { key: string }) => p.key)).toEqual(["count"]);

    // Delete it: the instance on the canvas still regenerates because it embeds its definition.
    await panel(page).getByRole("button", { name: "Delete Job runner" }).click();
    await expect(item(page, "job-runner")).toBeHidden();
    await selectInstance(page);
    await inspector(page).getByRole("button", { name: "Increase Count" }).click();
    await expect.poll(async () => countRole(await snap(page), /^worker-\d+$/)).toBe(2);

    // Import brings the definition back, and it survives a reload.
    await panel(page)
      .getByTestId("smart-import-input")
      .setInputFiles({
        name: "job-runner.archboard-smart.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(def)),
      });
    await expect(item(page, "job-runner")).toBeVisible();
    await waitSaved(page);
    await page.reload();
    await expect(panel(page)).toBeVisible(); // the panel's open state is remembered too
    await expect(item(page, "job-runner")).toBeVisible();
  });

  test("the JSON editor validates as you type and saves a hand-written definition", async ({
    page,
  }) => {
    await panel(page).getByRole("button", { name: "New from JSON" }).click();
    const dlg = page.getByRole("dialog", { name: "New component from JSON" });
    await expect(dlg.getByTestId("json-def-status")).toContainText("Valid: My service box");
    const area = dlg.getByTestId("json-def-text");
    const good = await area.inputValue();

    await area.fill(good.replace('"version": 1', '"version": 0'));
    await expect(dlg.getByTestId("json-def-status")).toContainText("version");
    await expect(dlg.getByRole("button", { name: "Save" })).toBeDisabled();
    await area.fill(good.replace("{{name}}", "{{nope}}"));
    await expect(dlg.getByTestId("json-def-status")).toContainText("unknown parameter");
    await area.fill("{ not json");
    await expect(dlg.getByTestId("json-def-status")).toContainText("Not valid JSON");
    await area.fill(good.replace('"my-service-box"', '"cqrs"'));
    await expect(dlg.getByTestId("json-def-status")).toContainText("built-in");

    await area.fill(good);
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(dlg.getByTestId("json-def-status")).toContainText("Saved");
    await dlg.getByRole("button", { name: "Close", exact: true }).click();
    await item(page, "my-service-box").click();
    await expect(inspector(page)).toContainText("My service box");
    expect(countRole(await snap(page), /^svc-\d+$/)).toBe(2);
    await inspector(page).getByLabel("Database").uncheck();
    await expect.poll(async () => roles(await snap(page)).includes("db")).toBe(false);
    await inspector(page).getByLabel("Database").check();
    await expect.poll(async () => roles(await snap(page)).includes("db")).toBe(true);
  });

  test("a hostile definition is neutralised on import: embedded SVG is sanitized before it is stored", async ({
    page,
  }) => {
    await panel(page)
      .getByTestId("smart-import-input")
      .setInputFiles({
        name: "evil.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            schema: "archboard.smart/1",
            id: "evil",
            name: "Evil",
            version: 1,
            params: [],
            nodes: [{ role: "x", element: { type: "image", x: 0, y: 0, file: "f" } }],
            files: {
              f: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="9" height="9"/></svg>',
            },
          }),
        ),
      });
    await expect(item(page, "evil")).toBeVisible();
    const stored = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const req = indexedDB.open("archboard");
          req.onsuccess = () => {
            const r = req.result.transaction("smartDefs").objectStore("smartDefs").get("evil");
            r.onsuccess = () => resolve(JSON.stringify(r.result));
          };
        }),
    );
    expect(stored).toContain("rect"); // the harmless part is kept
    expect(stored).not.toMatch(/script|onload|alert/);
  });
});

test("the .excalidraw file carries the metadata, so it still regenerates after re-import", async ({
  page,
}) => {
  await insert(page, "database-with-replicas");
  await openExport(page);
  await chooseOption(page, "Format", "JSON");
  const { buf, dl } = await downloadExport(page, "JSON");
  const json = JSON.parse(buf.toString("utf8"));
  const withMeta = json.elements.filter(
    (e: { customData?: { smartComponent?: unknown } }) => e.customData?.smartComponent,
  );
  expect(withMeta.length).toBe(json.elements.length); // plain Excalidraw ignores customData, so it degrades to shapes
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await page
    .getByTestId("import-input")
    .setInputFiles({ name: dl.suggestedFilename(), mimeType: "application/json", buffer: buf });
  await expect(page.getByTestId("scene-row")).toHaveCount(2);
  await page.getByTestId("scene-row").first().getByRole("button").first().click();
  await expect.poll(async () => roles(await snap(page)).includes("primary")).toBe(true);
  await selectInstance(page);
  await inspector(page).getByRole("button", { name: "Increase Read replicas" }).click();
  await expect.poll(async () => countRole(await snap(page), /^replica-\d+$/)).toBe(3);
});

test("the smart panels are accessible", async ({ page }) => {
  await insert(page, "queue-with-consumers");
  let axe = await new AxeBuilder({ page }).include('[data-testid="smart-inspector"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
  await panel(page).getByRole("button", { name: "New from JSON" }).click();
  axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
  await page.keyboard.press("Escape");
  await selectInstance(page);
  await panel(page).getByRole("button", { name: "Create from selection…" }).click();
  axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
});

// Deterministic seeds (derived from roles) make smart components pixel-stable, so they can have visual baselines.
for (const id of [
  "load-balanced-service",
  "queue-with-consumers",
  "cache-aside",
  "cqrs",
  "k8s-deployment",
]) {
  test(`visual: "${id}" export matches the reference`, async ({ page }) => {
    await insert(page, id);
    await page.keyboard.press("Escape");
    await openExport(page);
    await chooseOption(page, "Scale", "1×");
    const { buf } = await downloadExport(page, "PNG");
    expect(PNG.sync.read(buf).width).toBeGreaterThan(200);
    expect(buf).toMatchSnapshot(`smart-${id}.png`, { maxDiffPixelRatio: 0.003 });
  });
}
