/** Skeleton shown while the clips page loads on the server. */
export default function ClipsLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading clips">
      <div className="h-[104px] animate-pulse rounded-2xl border border-[#253244] bg-[#101824]" />
      <div>
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-[#101824]" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-[#253244] bg-[#101824]">
              <div className="aspect-video animate-pulse bg-[#131D2B]" />
              <div className="space-y-2 p-3.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#131D2B]" />
                <div className="h-9 animate-pulse rounded-lg bg-[#131D2B]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-[#101824]" />
        <div className="mb-4 h-[52px] animate-pulse rounded-2xl border border-[#253244] bg-[#0B1220]" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-[#253244] bg-[#101824]">
              <div className="aspect-[9/16] animate-pulse bg-[#131D2B]" />
              <div className="space-y-2 p-3.5">
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-[#131D2B]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[#131D2B]" />
                <div className="h-8 animate-pulse rounded-lg bg-[#131D2B]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
