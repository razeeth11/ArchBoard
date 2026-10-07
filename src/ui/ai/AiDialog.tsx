"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AiError, DEFAULT_MODEL, MAX_PROMPT, generateDsl } from "@/ai/generate";
import { getSetting, setSetting } from "@/persistence/repo";
import { useUi } from "@/store/ui";
import { Modal, btn, btnPrimary } from "@/ui/common/Modal";

export const DSL_STORAGE = "archboard:dsl:last";

export function AiDialog() {
  return (
    <Modal
      kind="ai"
      title={
        <>
          <Sparkles size={20} aria-hidden /> Draw with AI (bring your own key)
        </>
      }
      description="Describe a system in words. The result opens in the text editor so you can review and edit it before inserting anything."
    >
      <Body />
    </Modal>
  );
}

function Body() {
  const [prompt, setPrompt] = useState("");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      getSetting<string>("aiKey", ""),
      getSetting<string>("aiModel", DEFAULT_MODEL),
    ]).then(([k, m]) => {
      if (!alive) return;
      if (typeof k === "string") setKey(k);
      if (typeof m === "string" && m) setModel(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      if (remember) await setSetting("aiKey", key.trim());
      void setSetting("aiModel", model.trim() || DEFAULT_MODEL);
      const r = await generateDsl(prompt, { apiKey: key, model });
      try {
        localStorage.setItem(DSL_STORAGE, r.source);
      } catch {
        /* storage unavailable: the editor falls back to its sample */
      }
      useUi.getState().setDialog("dsl");
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <p className="border-border rounded-lg border p-3" data-testid="ai-notice">
        This is optional and off until you use it. Your description and your API key are sent{" "}
        <strong>directly from your browser to api.anthropic.com</strong>; ArchBoard has no server
        and never sees them. Keys are billed to your own account.
      </p>
      <label className="flex flex-col gap-1">
        What should it draw?
        <textarea
          data-testid="ai-prompt"
          value={prompt}
          maxLength={MAX_PROMPT}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A photo-sharing app with a CDN, API servers, a queue for thumbnails and object storage"
          className="border-border bg-surface h-24 rounded-lg border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Anthropic API key
        <input
          data-testid="ai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="border-border bg-surface h-9 rounded-lg border px-2 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        Model
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border-border bg-surface h-9 rounded-lg border px-2 font-mono"
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember the key in this browser (stored locally, never exported or shared)
      </label>
      {error && (
        <p role="alert" data-testid="ai-error" className="text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className={btn}
          onClick={() => {
            setKey("");
            void setSetting("aiKey", "");
          }}
        >
          Forget key
        </button>
        <button className={btn} onClick={() => useUi.getState().setDialog(null)}>
          Cancel
        </button>
        <button
          className={btnPrimary}
          disabled={busy || !prompt.trim() || !key.trim()}
          onClick={() => void run()}
        >
          {busy ? "Generating…" : "Generate diagram text"}
        </button>
      </div>
    </div>
  );
}
