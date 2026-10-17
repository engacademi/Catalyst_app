"use client";
export function LoadMore({
  query,
  label,
}: {
  query: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
    isFetchNextPageError: boolean;
  };
  label: string;
}) {
  if (!query.hasNextPage) return null;
  return (
    <div className="mt-5 text-center">
      <button
        type="button"
        disabled={query.isFetchingNextPage}
        onClick={() => query.fetchNextPage()}
        className="min-h-11 rounded-full border border-brand bg-surface px-6 text-sm font-semibold text-brand disabled:opacity-50"
      >
        {query.isFetchingNextPage
          ? "Loading…"
          : query.isFetchNextPageError
            ? `Retry loading ${label}`
            : `Load more ${label}`}
      </button>
      <p role="status" className="mt-2 text-xs text-muted">
        {query.isFetchNextPageError
          ? "Could not load the next page. Your current list is still available."
          : ""}
      </p>
    </div>
  );
}
