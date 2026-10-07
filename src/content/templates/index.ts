import type { Template } from "../types";
import { ARCHITECTURE } from "./architecture";
import { INTERVIEW } from "./interview";
import { OPS } from "./ops";

export const TEMPLATES: Template[] = [...INTERVIEW, ...ARCHITECTURE, ...OPS];
export const templateBySlug = (slug: string) => TEMPLATES.find((t) => t.slug === slug);
export const TEMPLATE_CATEGORIES = [
  ...new Set(TEMPLATES.map((t) => t.category)),
] as Template["category"][];
