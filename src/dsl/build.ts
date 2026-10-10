import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BuiltFile, StyleCtx } from "@/library/builder";
import { fitBoundText } from "@/library/fitText";
import { layoutElements } from "@/layout/elk";
import type { El } from "@/smart/reconcile";
import { compileDsl } from "./compile";
import { parseDsl, type Diagnostic, type DslProgram } from "./parser";

export interface DslBuild {
  program: DslProgram;
  diagnostics: Diagnostic[];
  elements: OrderedExcalidrawElement[];
  files: BuiltFile[];
}

/** Source → positioned Excalidraw elements: parse, compile, convert, then auto-layout with ELK. */
export async function buildDsl(source: string, style?: StyleCtx): Promise<DslBuild> {
  const { program, diagnostics } = parseDsl(source);
  if (program.nodes.length === 0) return { program, diagnostics, elements: [], files: [] };
  const compiled = await compileDsl(program, style);
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  const els = convertToExcalidrawElements(compiled.skeleton, {
    regenerateIds: false,
  }) as OrderedExcalidrawElement[];
  fitBoundText(els);
  const laid = await layoutElements(els as unknown as El[], program.layout);
  const moved = new Map(laid.elements.map((e) => [e.id, e]));
  const elements = els.map((e) => (moved.get(e.id) ?? e) as unknown as OrderedExcalidrawElement);
  return { program, diagnostics, elements, files: compiled.files };
}
