/**
 * Automatic lists for text editing (pure functions, so they are easy to test).
 *  - Enter on a list line continues the list ("- a" → "- " ; "3. a" → "4. ").
 *  - Enter on an empty list line ends the list.
 *  - Ctrl/Cmd+Shift+8 / +7 turn the selected lines into a bullet / numbered list (or back).
 */
export interface TextEdit {
  value: string;
  selStart: number;
  selEnd: number;
}

const ITEM = /^(\s*)([-*•]|(\d+)([.)]))\s+/;

export function continueList(value: string, selStart: number, selEnd: number): TextEdit | null {
  if (selStart !== selEnd) return null;
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const nl = value.indexOf("\n", selStart);
  const lineEnd = nl === -1 ? value.length : nl;
  const line = value.slice(lineStart, lineEnd);
  const m = ITEM.exec(line);
  if (!m) return null;
  const prefixEnd = lineStart + m[0].length;
  if (selStart < prefixEnd) return null; // caret inside the marker itself: plain Enter
  const body = line.slice(m[0].length);
  if (body.trim() === "" && selStart === lineEnd) {
    // Enter on an empty item finishes the list.
    const v = value.slice(0, lineStart) + value.slice(lineEnd);
    return { value: v, selStart: lineStart, selEnd: lineStart };
  }
  const next = m[3] !== undefined ? `${m[1]}${Number(m[3]) + 1}${m[4]} ` : `${m[1]}${m[2]} `;
  const v = value.slice(0, selStart) + "\n" + next + value.slice(selStart);
  const caret = selStart + 1 + next.length;
  return { value: v, selStart: caret, selEnd: caret };
}

export function toggleList(
  value: string,
  selStart: number,
  selEnd: number,
  kind: "bullet" | "number",
): TextEdit {
  const start = value.lastIndexOf("\n", selStart - 1) + 1;
  const nl = value.indexOf("\n", selEnd);
  const end = nl === -1 ? value.length : nl;
  const lines = value.slice(start, end).split("\n");
  const marked = (l: string) =>
    kind === "bullet" ? /^\s*[-*•]\s+/.test(l) : /^\s*\d+[.)]\s+/.test(l);
  const content = lines.filter((l) => l.trim() !== "");
  const allMarked = content.length > 0 && content.every(marked);
  let n = 0;
  const out = lines.map((l) => {
    if (l.trim() === "") return l;
    const bare = l.replace(ITEM, "$1");
    if (allMarked) return bare;
    n += 1;
    return `${kind === "bullet" ? "• " : `${n}. `}${bare}`;
  });
  const replaced = out.join("\n");
  const v = value.slice(0, start) + replaced + value.slice(end);
  return { value: v, selStart: start, selEnd: start + replaced.length };
}

/** Wire the behaviour into Excalidraw's text editor (a textarea created while editing a label or text). */
export function installTextLists(): () => void {
  const isEditor = (t: EventTarget | null): t is HTMLTextAreaElement =>
    t instanceof HTMLTextAreaElement && t.classList.contains("excalidraw-wysiwyg");
  const apply = (ta: HTMLTextAreaElement, e: TextEdit) => {
    ta.value = e.value;
    ta.setSelectionRange(e.selStart, e.selEnd);
    // Excalidraw reads the text through its input listener: this resizes the shape as it grows.
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const onKey = (ev: KeyboardEvent) => {
    const ta = ev.target;
    if (!isEditor(ta) || ev.isComposing) return;
    if (ev.key === "Enter" && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const edit = continueList(ta.value, ta.selectionStart, ta.selectionEnd);
      if (edit) {
        ev.preventDefault();
        ev.stopPropagation();
        apply(ta, edit);
      }
      return;
    }
    if (
      (ev.ctrlKey || ev.metaKey) &&
      ev.shiftKey &&
      (ev.code === "Digit8" || ev.code === "Digit7")
    ) {
      ev.preventDefault();
      ev.stopPropagation();
      apply(
        ta,
        toggleList(
          ta.value,
          ta.selectionStart,
          ta.selectionEnd,
          ev.code === "Digit8" ? "bullet" : "number",
        ),
      );
    }
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}
