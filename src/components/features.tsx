const features = [
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Access un-opinionated, multi-venue yield",
    description:
      "Access the best risk-adjusted yield on Solana while enabling your Agent to borrow against all positions with unified margin, risk, & credit. (Including Kamino, Drift, Project 0, & Jupiter)",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: "Your agent-native money market",
    description:
      "Protect your agent's balances from inflation. Create an account in a single command, permissionlessly, anonymously, & with complete self-custody",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 14h2" />
        <path d="M12 14h6" />
      </svg>
    ),
    title: "Access cross-venue strategies",
    description:
      "Now your agent can access yields with specific exposue, inlcuding sophisticated multi-venue delta-neutral strategies.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "Project 0 Pay",
    description:
      "Borrow stablecoins against your yield generating portfolio to fund agentic payments using the x402 protocol.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-5xl px-4 py-16">
      {/* Section header */}
      <div className="mb-16 flex flex-col items-center text-center max-w-md mx-auto">
        <span className="mb-4 font-mono text-xs uppercase tracking-wider text-p0-purple">
          Capabilities
        </span>
        <h2 className="text-3xl font-medium md:text-4xl">
          What agents can do with the Project 0 skill
        </h2>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            {/* Hover glow */}
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-p0-purple/0 blur-[60px] transition-all duration-500 group-hover:bg-p0-purple/10" />

            <div className="relative">
              {/* Icon */}
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-p0-purple">
                {feature.icon}
              </div>

              {/* Title */}
              <h3 className="mb-3 font-mono text-sm font-medium uppercase tracking-wide text-white">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
