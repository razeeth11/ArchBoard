import Link from "next/link";

export function Breadcrumbs({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted mb-4 text-sm">
      <ol className="flex flex-wrap gap-1">
        {trail.map((t, i) => (
          <li key={t.path} className="flex gap-1">
            {i < trail.length - 1 ? (
              <>
                <Link href={t.path} className="hover:text-fg underline">
                  {t.name}
                </Link>
                <span aria-hidden>/</span>
              </>
            ) : (
              <span aria-current="page">{t.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
