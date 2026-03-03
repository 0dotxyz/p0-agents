"use client";

import { useState, useRef, useCallback } from "react";

const SUPABASE_BASE =
  "https://xcdlwgvabmruuularsvn.supabase.co/storage/v1/object/public/agent-videos";

const videos = [
  { label: "Explore Strategies", src: `${SUPABASE_BASE}/agents-1.mp4` },
  { label: "Earning Yield", src: `${SUPABASE_BASE}/agents-2.mp4` },
  { label: "Borrowing", src: `${SUPABASE_BASE}/agents-3.mp4` },
];

export default function VideoDemo() {
  const [active, setActive] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const switchTo = useCallback(
    (index: number) => {
      const outgoing = videoRefs.current[active];
      if (outgoing) {
        outgoing.pause();
        outgoing.currentTime = 0;
      }

      setActive(index);

      const incoming = videoRefs.current[index];
      if (incoming) {
        incoming.currentTime = 0;
        incoming.play();
      }
    },
    [active],
  );

  const handleTabClick = useCallback(
    (index: number) => {
      if (index === active) return;
      switchTo(index);
    },
    [active, switchTo],
  );

  const handleEnded = useCallback(
    (index: number) => {
      switchTo((index + 1) % videos.length);
    },
    [switchTo],
  );

  return (
    <section className="relative mx-auto max-w-4xl px-4 py-4">
      {/* Tab buttons */}
      <div className="mb-4 flex items-center justify-center gap-1">
        {videos.map((video, i) => (
          <button
            key={video.label}
            onClick={() => handleTabClick(i)}
            className={`w-44 cursor-pointer rounded-lg py-2 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
              i === active
                ? "bg-white/[0.08] text-white"
                : "text-[var(--color-muted-foreground)] hover:text-white/60"
            }`}
          >
            {video.label}
          </button>
        ))}
      </div>

      {/* Video container */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#191A25] p-2 md:p-3">
        {videos.map((video, i) => (
          <video
            key={video.label}
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            className={`w-full rounded-xl ${i === active ? "" : "hidden"}`}
            muted
            playsInline
            autoPlay={i === 0}
            onEnded={() => handleEnded(i)}
          >
            <source src={video.src} type="video/mp4" />
          </video>
        ))}
      </div>
    </section>
  );
}
