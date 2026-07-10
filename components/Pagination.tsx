import Link from 'next/link';

interface Props {
  currentPage: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string>;
}

function buildHref(page: number, basePath: string, params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== 'page') sp.set(k, v);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ currentPage, totalPages, basePath, params }: Props) {
  if (totalPages <= 1) return null;

  function renderPageBtn(p: number) {
    const isActive = p === currentPage;
    return (
      <Link
        key={p}
        href={buildHref(p, basePath, params)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 36,
          height: 36,
          padding: '0 10px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          background: isActive ? 'var(--primary)' : 'transparent',
          color: isActive ? '#fff' : 'var(--muted)',
          border: isActive ? 'none' : '1px solid var(--line)',
          transition: 'all 0.18s ease',
        }}
      >
        {p}
      </Link>
    );
  }

  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 18,
        flexWrap: 'wrap',
      }}
      aria-label="Paginación"
    >
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1, basePath, params)}
          className="btn ghost"
          style={{ padding: '8px 14px', fontSize: 12, minHeight: 36 }}
        >
          ← Anterior
        </Link>
      )}

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} style={{ color: 'var(--muted)', fontSize: 13, padding: '0 4px' }}>···</span>
        ) : (
          renderPageBtn(p)
        )
      )}

      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1, basePath, params)}
          className="btn ghost"
          style={{ padding: '8px 14px', fontSize: 12, minHeight: 36 }}
        >
          Siguiente →
        </Link>
      )}
    </nav>
  );
}
