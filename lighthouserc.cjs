// Lighthouse CI against the static export. Run: pnpm build && pnpm lhci
module.exports = {
  ci: {
    collect: {
      staticDistDir: "./out",
      // The export writes <route>.html files; the CI static server needs the real file names.
      url: [
        "/index.html",
        "/templates.html",
        "/templates/url-shortener.html",
        "/guides/system-design-diagram.html",
        "/vs/excalidraw.html",
        "/components.html",
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox --headless=new",
        // The sandbox has no network shaping; use Lighthouse's default simulated mobile throttling.
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
