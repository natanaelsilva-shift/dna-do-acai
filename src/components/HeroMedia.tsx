"use client";

import { useState } from "react";

export function HeroMedia() {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div className="relative flex w-full items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[72%] w-[min(88vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(75,22,76,0.28)_0%,rgba(16,61,44,0.2)_48%,transparent_72%)] blur-3xl"
      />

      <div className="relative h-[min(72svh,720px)] max-w-[94vw] aspect-[9/16] overflow-hidden rounded-[22px] border border-[#d7a948]/35 bg-white/[0.06] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.42),0_0_50px_rgba(120,45,150,0.1)] backdrop-blur-sm motion-safe:[animation:dna-about-fade_650ms_ease-out_both] sm:h-[min(74svh,760px)] sm:rounded-[26px] lg:h-[min(78vh,820px)] lg:rounded-[28px]">
        <div className="relative size-full overflow-hidden rounded-[17px] bg-[linear-gradient(145deg,#0b2c20_0%,#2b132d_62%,#07150f_100%)] sm:rounded-[21px]">
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <p className="text-xl font-black uppercase tracking-[0.2em] text-[#f8e8b5] sm:text-2xl">
              DNA do Açaí
            </p>
          </div>

          {!videoFailed ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Copo de açaí DNA do Açaí"
              className={`absolute inset-0 size-full bg-transparent object-contain object-center transition-opacity duration-500 motion-reduce:transition-none ${
                videoReady ? "opacity-100" : "opacity-0"
              }`}
              onCanPlay={() => setVideoReady(true)}
              onError={(event) => {
                if (event.currentTarget.error) {
                  setVideoFailed(true);
                  setVideoReady(false);
                }
              }}
            >
              <source src="/videos/acai-hero.webm" type="video/webm" />
              <source src="/videos/acai-hero.mp4" type="video/mp4" />
            </video>
          ) : null}
        </div>
      </div>
    </div>
  );
}
