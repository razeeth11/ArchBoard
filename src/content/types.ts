export type TemplateCategory =
  | "Interview classics"
  | "Web architecture"
  | "Data and storage"
  | "Messaging and events"
  | "Reliability"
  | "Security"
  | "DevOps";

export interface Template {
  slug: string;
  title: string;
  category: TemplateCategory;
  /** One sentence, 80-110 chars: the meta description adds a short suffix. */
  summary: string;
  /** 120-200 words of original copy: what the design shows, why, and where it breaks. */
  body: string;
  /** Diagram DSL source; every template is parsed and compiled in tests. */
  dsl: string;
  /** Guide slugs and component (block/smart) ids to link to. */
  guides?: string[];
  keywords: string[];
}
