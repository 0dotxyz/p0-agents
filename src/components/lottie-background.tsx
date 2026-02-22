"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import type { DotLottie } from "@lottiefiles/dotlottie-react";

const DotLottieReact = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({
    default: m.DotLottieReact,
  })),
);

export default function LottieBackground() {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleRef = useCallback((dotLottie: DotLottie) => {
    if (dotLottie) {
      dotLottie.addEventListener("play", () => {
        setIsLoaded(true);
      });
    }
  }, []);

  return (
    <div
      className={`absolute inset-0 -top-8 left-1/2 hidden -translate-x-1/2 transition-opacity duration-1000 lg:block ${
        isLoaded ? "opacity-100" : "opacity-0"
      }`}
      style={{ width: "2560px", height: "395px" }}
    >
      <Suspense fallback={null}>
        <DotLottieReact
          src="/lottie/dark/main.json"
          loop
          autoplay
          speed={0.25}
          dotLottieRefCallback={handleRef}
        />
      </Suspense>
    </div>
  );
}
