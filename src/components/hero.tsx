"use client";

import { useState } from "react";
import LottieBackground from "@/components/lottie-background";

export default function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText("npx skills add 0dotxyz/skill");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden pt-12">
      {/* Mobile fallback: static SVG */}
      <img
        src="/images/backgrounds/dark/main.svg"
        alt=""
        className="absolute inset-0 top-28 left-1/2 w-[2560px] -translate-x-1/2 lg:hidden"
        loading="eager"
      />

      {/* Desktop: Lottie animation */}
      <LottieBackground />

      <div className="relative mx-auto max-w-5xl px-4 md:px-6">
        <div className="flex flex-col items-center pb-16 pt-24">
          {/* Blurred backdrop */}
          <div className="absolute left-1/2 top-1/2 h-[200px] w-[320px] -translate-x-1/2 -translate-y-1/2 bg-[#0b0b10] blur-[60px] lg:h-[300px] lg:w-[600px]" />

          {/* Content */}
          <div className="relative flex flex-col items-center space-y-4">
            <div className="space-y-2">
              {/* Heading */}
              <h1 className="gradient-text py-1 text-center text-5xl font-medium leading-tight md:text-6xl lg:text-7xl">
                DeFi for AI Agents
              </h1>

              {/* Subheading */}
              <p className="max-w-2xl text-center text-lg text-[var(--color-muted-foreground)] md:text-xl lg:text-2xl">
                Grow your agent's portfolio with unified yield &amp; credit
              </p>
            </div>

            {/* Install command */}
            <div id="install" className="mt-4 w-full max-w-md">
              <div className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06]">
                <span className="text-p0-purple font-mono text-sm">$</span>
                <code className="flex-1 font-mono text text-white/90">
                  npx skills add 0dotxyz/skill
                </code>
                <button
                  onClick={handleCopy}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition-all hover:bg-white/10 hover:text-white/80"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-green-400"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
