export const SITE = {
  name: "ArchBoard",
  url: "https://archboard.app",
  tagline: "Free whiteboard for system design and architecture diagrams",
  description:
    "ArchBoard is a free, private, offline-first whiteboard for architecture and system design diagrams. No sign-up. Your drawings never leave your device.",
} as const;

export const NAV = [
  { href: "/templates", label: "Templates" },
  { href: "/components", label: "Components" },
  { href: "/guides", label: "Guides" },
  { href: "/vs", label: "Compare" },
  { href: "/about", label: "About" },
] as const;
