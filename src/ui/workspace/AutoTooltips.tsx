"use client";

import { useEffect } from "react";

const SELECTOR = "button, [role='button'], [role='tab'], [role='menuitem'], a[href]";

function label(el: HTMLElement): string {
  const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function apply(el: HTMLElement) {
  if (el.hasAttribute("title")) return;
  const text = label(el);
  if (text) el.setAttribute("title", text);
}

/** Native tooltip for every control that lacks one, taken from its accessible label or text. */
export function AutoTooltips() {
  useEffect(() => {
    const sweep = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(SELECTOR)) apply(root);
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach(apply);
    };
    sweep(document);
    let queued = false;
    const pending = new Set<Node>();
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n.nodeType === 1 && pending.add(n));
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        pending.forEach((n) => sweep(n as HTMLElement));
        pending.clear();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
