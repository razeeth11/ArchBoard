"use client";

import dynamic from "next/dynamic";

// Client-only and lazy: the database code stays out of the home page's first load.
const Recent = dynamic(() => import("./RecentScenes").then((m) => m.RecentScenes), { ssr: false });

export function RecentLoader() {
  return <Recent />;
}
