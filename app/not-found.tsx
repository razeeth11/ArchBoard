import Link from "next/link";
import { Page } from "@/ui/SiteShell";

export const metadata = { title: "Page not found | ArchBoard", robots: { index: false } };

export default function NotFound() {
  return (
    <Page title="Page not found">
      <p className="text-muted">
        That page does not exist.{" "}
        <Link href="/" className="underline">
          Go home
        </Link>
        .
      </p>
    </Page>
  );
}
