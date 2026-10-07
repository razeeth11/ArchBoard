import { PNG } from "pngjs";
import { expect, test } from "./fixtures";
import { diagrams } from "../fixtures/diagrams";
import { chooseOption, downloadExport, loadDiagram, openExport } from "./export-helpers";
import { openEditor } from "./helpers";

// Visual regression for export output: five reference diagrams with fixed seeds, exported at 1x.
// Baselines live next to this file; regenerate deliberately with `--update-snapshots`.
for (const d of diagrams()) {
  test(`PNG export of "${d.name}" matches the reference`, async ({ page }) => {
    await openEditor(page);
    await loadDiagram(page, d);
    await openExport(page);
    await chooseOption(page, "Scale", "1×");
    const { buf } = await downloadExport(page, "PNG");
    expect(PNG.sync.read(buf).width).toBeGreaterThan(50);
    expect(buf).toMatchSnapshot(`${d.name}.png`, { maxDiffPixelRatio: 0.002 });
  });
}
