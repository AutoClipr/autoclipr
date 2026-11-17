import { Film, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Video } from "@/lib/api";
import { formatDuration } from "@/lib/utils";

export function VideoCard({ video }: { video: Video }) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-white/20">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-t-3xl bg-black">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <Film className="h-12 w-12 text-muted-foreground" />
        )}
        <Badge
          variant={video.status === "ready" ? "success" : "outline"}
          className="absolute right-2 top-2"
        >
          {video.status}
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="truncate font-semibold text-white">{video.title}</h3>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/45">
          <Clock className="h-3 w-3" />
          {video.duration_seconds
            ? formatDuration(video.duration_seconds)
            : "Processing…"}
        </div>
      </CardContent>
    </Card>
  );
}
