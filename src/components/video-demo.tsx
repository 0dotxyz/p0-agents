export default function VideoDemo() {
  return (
    <section className="relative mx-auto max-w-4xl px-4 py-8">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#191A25] p-2 md:p-3">
        <video className="w-full rounded-xl" autoPlay loop muted playsInline>
          <source
            src="https://xcdlwgvabmruuularsvn.supabase.co/storage/v1/object/public/agent-videos/agents-1.mp4"
            type="video/mp4"
          />
        </video>
      </div>
    </section>
  );
}
