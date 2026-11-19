import { Check, ExternalLink, Info, Loader2, Trash2, Youtube } from "lucide-react";
import type { YoutubeChannel } from "@/lib/api";
import { formatConnectedDate } from "@/lib/utils";

type ConnectedChannelRowProps = {
  channel: YoutubeChannel;
  onRemove?: (id: string) => void;
  removing?: boolean;
};

export function ConnectedChannelRow({
  channel,
  onRemove,
  removing,
}: ConnectedChannelRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#253244] bg-[#0B1220] p-3 transition-colors hover:border-[#35445a]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {channel.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full border border-[#253244] object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/15">
            <Youtube className="h-4 w-4 text-[#FF4d4d]" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#F8FAFC]">{channel.channel_name}</p>
          <p className="truncate text-xs text-[#64748B]">{channel.channel_url}</p>
          <p className="mt-0.5 text-[11px] text-[#64748B]">Added {formatConnectedDate(channel.created_at)}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1 rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#86efac] sm:inline-flex">
          <Check className="h-3 w-3" />
          Saved
        </span>
        <a
          href={channel.channel_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          aria-label="Open channel"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(channel.id)}
            disabled={removing}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-red-400 disabled:opacity-50"
            aria-label="Remove channel"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function ConnectedChannelsHeading({ count }: { count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <p className="text-sm font-semibold">Connected Channels</p>
      <Info
        className="h-3.5 w-3.5 text-muted-foreground"
        aria-label="AutoClipr monitors these channels for new uploads"
      />
      {count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
