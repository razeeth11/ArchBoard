# Smart Components

A **Smart Component** is a named, versioned, parameterized group of Excalidraw elements produced by a
_pure function of its props_. Select one on the canvas and the **properties panel** appears; changing a
property regenerates the diagram **in place**.

Everything is stored in the scene as ordinary elements plus metadata, so files stay portable: a plain
Excalidraw ignores the metadata and shows normal, editable shapes.

## Stored shape

Every element of an instance carries (in `customData`):

```json
{
  "smartComponent": {
    "id": "load-balanced-service",
    "version": 1,
    "instance": "e7c03aa7",
    "role": "replica-2",
    "props": {
      "replicas": 3,
      "lbType": "L7",
      "showHealthChecks": true,
      "serviceName": "Orders service"
    },
    "def": { "...": "only on the root element of custom components" }
  }
}
```

- `instance` groups the elements of one component on the canvas.
- `role` is the element's **stable identity** inside the component (`lb`, `replica-2`, `replica-2:label`…).
  Element ids are `sc_<instance>_<role>`, so regenerating keeps the same ids.
- Custom components embed their definition on the root element, so a shared file can still be edited on a
  machine that never installed the definition.

## Regeneration (what is preserved)

`regenerate(instance, newProps)` runs the generator for the **old** and **new** props, then merges:

| Aspect                    | Behaviour                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position                  | Anchored to where the root frame currently sits, so a moved component stays put.                                                                                                       |
| Style and text edits      | A field (`strokeColor`, `backgroundColor`, `text`, …) that differs from what the _previous_ generation produced is a user override and is kept. Untouched fields follow the generator. |
| Arrows from outside       | Ids are stable, so bindings persist; their ends are re-routed to the part's new edge. Ends attached to a part that no longer exists are unbound.                                       |
| Structure the canvas owns | `groupIds`, `frameId`, z-index and `locked` are never overwritten.                                                                                                                     |
| New / removed parts       | Added on top / marked deleted (undo restores them).                                                                                                                                    |
| Undo                      | One undo step per change.                                                                                                                                                              |

Not preserved: hand-moved positions of _individual parts_ (layout is generator-driven) and user-deleted
parts (they come back when the component regenerates).

## Ports

Each component exposes named ports (`in`, `out`, `replica-1`, `primary`, …). A port names the element that
arrows connect to. Shift-click the component and another shape, then press **Connect** next to a port in
the panel: a bound arrow is created, and it follows the component when its properties change.

## Built-in components (17)

Load-balanced service · Database with replicas · Queue with consumers · Cache-aside · API gateway fan-out ·
Kubernetes deployment · CQRS · Saga orchestrator · Event sourcing · Circuit breaker · Three-tier web app ·
Multi-region active/passive · CDN with origin shield · ETL pipeline · Pub/sub fan-out · Worker pool ·
Service mesh.

Built-ins are TypeScript in `src/smart/defs.ts` using the `SB` builder (`src/smart/sbuilder.ts`). Rules for
a generator: be pure and deterministic, derive every `role` from props only, make `root` the outermost
frame (`sb.wrap("root", …)`), and only use `edge()` between roles that exist. `tests/unit/smart-defs.test.ts`
checks these for every component, including property-based tests with random and out-of-range props.

## Custom components (no code)

Create them two ways:

1. **From selection** — select shapes, _Components → Smart → Create from selection…_. Pick which labels
   become properties and (optionally) one part to repeat N times.
2. **From JSON** — _New from JSON_ opens an editor with live validation, or import a `.archboard-smart.json`.

### Definition schema (`archboard.smart/1`)

```jsonc
{
  "schema": "archboard.smart/1",
  "id": "my-service-box", // lowercase letters, digits, dashes (2–41 chars)
  "name": "My service box",
  "version": 1, // bump when the generated structure changes
  "description": "…",
  "category": "Custom",
  "keywords": ["…"],
  "params": [
    // ≤ 20; becomes the properties panel
    { "key": "name", "label": "Name", "type": "text", "default": "Service" },
    { "key": "count", "label": "Copies", "type": "number", "default": 2, "min": 1, "max": 6 },
    { "key": "db", "label": "Database", "type": "boolean", "default": true },
    { "key": "kind", "label": "Kind", "type": "select", "default": "a", "options": ["a", "b"] },
  ],
  "nodes": [
    // ≤ 200 nodes, ≤ 1000 expanded elements
    {
      "role": "svc",
      "element": {
        "type": "rectangle",
        "x": 0,
        "y": 0,
        "width": 140,
        "height": 60,
        "backgroundColor": "#d3f9d8",
        "text": "{{name}} #{{i}} ({{kind}})",
      },
      "repeat": { "count": "count", "dx": 0, "dy": 80 },
    }, // role becomes svc-1, svc-2, …
    {
      "role": "db",
      "element": { "type": "ellipse", "x": 220, "y": 0, "width": 90, "height": 60, "text": "DB" },
      "visibleIf": "db",
    }, // "!db" inverts
    {
      "role": "link",
      "element": { "type": "arrow", "x": 0, "y": 0, "start": "svc", "end": "db", "text": "reads" },
      "repeat": { "count": "count", "dx": 0, "dy": 80 },
      "visibleIf": "db",
    },
  ],
  "ports": [{ "name": "in", "role": "svc", "description": "First service" }],
  "files": { "icon": "<svg …>" }, // SVG documents for `image` nodes (sanitized on import)
}
```

- `element.type`: `rectangle | ellipse | diamond | text | line | arrow | image`. Style fields mirror
  Excalidraw (`strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `roughness`,
  `opacity`, `roundness`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign`, arrowheads).
- `text` on a shape is its bound label. `{{param}}` inserts a property; `{{i}}` is the 1-based repeat index.
- Arrow `start`/`end` name roles. If the target repeats, an arrow that repeats too binds to the same index;
  otherwise it binds to the first copy.
- Definitions are **data, never code**: nothing in them is evaluated. They are validated strictly
  (`parseTemplateDef`), SVG files are sanitized, and counts/sizes are capped.

## Files

`src/smart/`: `types.ts` (props schema, meta), `sbuilder.ts` (generator DSL), `defs.ts` (built-ins),
`template.ts` (JSON engine + validation), `fromSelection.ts`, `materialize.ts` (skeleton → elements with
stable ids, deterministic seeds, arrow routing), `reconcile.ts` (merge + external re-binding),
`instance.ts` (insert / regenerate / detach / connect), `registry.ts`.
UI: `src/ui/smart/` (Smart tab, inspector, create dialog, JSON editor).
