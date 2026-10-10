import { describe, expect, it } from "vitest";
import { continueList, toggleList } from "@/engine/textList";

describe("continueList", () => {
  it("continues a bullet list", () => {
    const r = continueList("- one", 5, 5)!;
    expect(r.value).toBe("- one\n- ");
    expect(r.selStart).toBe(r.value.length);
  });
  it("continues a numbered list with the next number and the same delimiter", () => {
    expect(continueList("1. a\n2. b", 9, 9)!.value).toBe("1. a\n2. b\n3. ");
    expect(continueList("9) x", 4, 4)!.value).toBe("9) x\n10) ");
  });
  it("splits a line when the caret is in the middle and keeps the indent", () => {
    const r = continueList("  - alpha beta", 9, 9)!;
    expect(r.value).toBe("  - alpha\n  -  beta");
  });
  it("ends the list on an empty item", () => {
    expect(continueList("- a\n- ", 6, 6)!.value).toBe("- a\n");
  });
  it("does nothing for plain text, selections, or a caret inside the marker", () => {
    expect(continueList("hello", 5, 5)).toBeNull();
    expect(continueList("- a", 0, 3)).toBeNull();
    expect(continueList("- a", 1, 1)).toBeNull();
  });
  it("works on the line the caret is on, not just the last one", () => {
    expect(continueList("1. a\nplain", 4, 4)!.value).toBe("1. a\n2. \nplain");
  });
});

describe("toggleList", () => {
  it("turns selected lines into a numbered list and back", () => {
    const a = toggleList("a\nb\nc", 0, 5, "number");
    expect(a.value).toBe("1. a\n2. b\n3. c");
    const b = toggleList(a.value, a.selStart, a.selEnd, "number");
    expect(b.value).toBe("a\nb\nc");
  });
  it("bullets, skipping blank lines, and switches list kinds", () => {
    const a = toggleList("x\n\ny", 0, 4, "bullet");
    expect(a.value).toBe("• x\n\n• y");
    expect(toggleList("1. x\n2. y", 0, 9, "bullet").value).toBe("• x\n• y");
  });
});
