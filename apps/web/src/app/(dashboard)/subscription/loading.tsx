/** Skeleton while billing data loads — never shows a placeholder balance. */
export default function SubscriptionLoading() {
  const block = "animate-pulse rounded-2xl border border-[#253244] bg-[#101824]";
  return (
    <div className="mx-auto max-w-5xl space-y-5" aria-busy="true" aria-label="Loading billing">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-[#101824]" />
        <div className="h-8 w-72 animate-pulse rounded bg-[#101824]" />
      </div>
      <div className={`${block} h-40`} />
      <div className="grid gap-5 md:grid-cols-2">
        <div className={`${block} h-64`} />
        <div className={`${block} h-64`} />
      </div>
      <div className={`${block} h-96`} />
    </div>
  );
}
