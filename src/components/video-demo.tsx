export default function VideoDemo() {
  return (
    <section className="relative mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
      {/* Video placeholder */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow effect */}
        <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-p0-purple/20 blur-[80px]" />

        {/* Play button and text */}
        <div className="relative flex h-full flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="white"
              className="ml-1"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <p className="font-mono text-xs uppercase tracking-wider text-white/40">
            Agent demo coming soon
          </p>
        </div>
      </div>
    </section>
  );
}
