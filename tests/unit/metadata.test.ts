import { describe, expect, it } from "vitest";
import { pageMetadata } from "@/lib/metadata";

describe("pageMetadata", () => {
  it("sets canonical and social tags from one source", () => {
    const m = pageMetadata({ title: "T", description: "D", path: "/x" });
    expect(m.alternates?.canonical).toBe("/x");
    expect(m.openGraph?.title).toBe("T");
    expect(m.robots).toBeUndefined();
  });
  it("supports noindex", () => {
    expect(
      pageMetadata({ title: "T", description: "D", path: "/x", noindex: true }).robots,
    ).toEqual({
      index: false,
      follow: false,
    });
  });
});
