import { Suspense } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
}

async function fetchVideos(): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=6&type=video`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.items ?? []).map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        "",
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
  } catch {
    return [];
  }
}

async function VideoGrid() {
  const videos = await fetchVideos();
  if (videos.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {videos.map((video) => (
        <a
          key={video.id}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-dark-900 rounded-2xl overflow-hidden border border-white/7 hover:border-brand/30 transition-all duration-300"
        >
          <div className="relative aspect-video">
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-brand/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Play size={22} className="text-white fill-white ml-1" />
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {video.title}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-dark-900 rounded-2xl overflow-hidden border border-white/7 animate-pulse"
        >
          <div className="aspect-video bg-white/5" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-white/5 rounded w-full" />
            <div className="h-3 bg-white/5 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function YouTubeVideos() {
  return (
    <section id="youtube" className="relative py-24 bg-dark-900">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full mb-4">
            <Play size={15} />
            Canal YouTube
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 text-white">
            Conteúdo no <span className="text-gradient">YouTube</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Dicas, estratégias e conteúdo educativo para sellers e distribuidores.
          </p>
        </div>

        <Suspense fallback={<GridSkeleton />}>
          <VideoGrid />
        </Suspense>
      </div>
    </section>
  );
}
