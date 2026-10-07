import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ["out/**", ".next/**", "public/excalidraw-assets/**", "next-env.d.ts"] },
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
];

export default config;
