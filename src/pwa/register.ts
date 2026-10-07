import { t } from "@/i18n/messages";
import { useToasts } from "@/store/toasts";

/**
 * Register the service worker (production builds only). When a new version has installed, offer a
 * reload instead of swapping silently, so nobody loses an unsaved edit to a surprise refresh.
 */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  const secure = location.protocol === "https:" || location.hostname === "localhost";
  if (!secure) return;
  // Wait until the editor has settled: installing (a few MB of precache) must not compete with startup.
  const start = () => setTimeout(() => void install(), 5000);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

function install() {
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      const offer = (worker: ServiceWorker) =>
        useToasts.getState().push({
          message: t("update.ready"),
          ttl: 0,
          action: {
            label: t("update.reload"),
            run: () => {
              worker.postMessage("SKIP_WAITING");
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                {
                  once: true,
                },
              );
            },
          },
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) offer(w);
        });
      });
    })
    .catch(() => undefined); // offline support is an enhancement; never an error
}
