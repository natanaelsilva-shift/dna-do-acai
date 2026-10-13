"use client";

import { useEffect, useRef } from "react";

// Assinatura de transição da marca: uma massa de açaí sobe e cobre o fim do
// hero, revelando a seção seguinte (que tem o mesmo roxo). Três camadas SVG
// em parallax, só transform — sem morph de path, para ficar leve no celular.
// Sem JS ou com reduced motion, a borda aparece estática na posição final.

const EDGE_BACK =
  "M0 150C110 92 210 176 340 128S560 54 700 104 930 182 1080 120 1330 64 1440 112V320H0Z";
const EDGE_MID =
  "M0 182C150 128 250 206 410 160S640 98 790 146 1010 214 1170 158 1360 112 1440 150V320H0Z";
const EDGE_FRONT =
  "M0 214C130 170 240 244 380 204S600 150 760 192 990 258 1150 210 1350 168 1440 196V320H0Z";
const EDGE_FRONT_GLOSS =
  "M0 214C130 170 240 244 380 204S600 150 760 192 990 258 1150 210 1350 168 1440 196";

export function DnaWave({ className = "" }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let revert: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: root,
              start: "top bottom",
              end: "bottom bottom",
              scrub: 0.5,
            },
          })
          .fromTo(q(".wave-back"), { yPercent: 70, xPercent: -6 }, { yPercent: 0, xPercent: 0 }, 0)
          .fromTo(q(".wave-mid"), { yPercent: 95, xPercent: 5 }, { yPercent: 0, xPercent: 0 }, 0)
          .fromTo(q(".wave-front"), { yPercent: 120, xPercent: -3 }, { yPercent: 0, xPercent: 0 }, 0);
      });

      revert = () => media.revert();
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`pointer-events-none relative h-[42svh] overflow-hidden lg:h-[56svh] ${className}`}
    >
      <WaveLayer className="wave-back" path={EDGE_BACK} fill="#6d2a7a" opacity={0.75} />
      <WaveLayer className="wave-mid" path={EDGE_MID} fill="#5a1f60" />
      <WaveLayer className="wave-front" path={EDGE_FRONT} fill="#4b164c" gloss={EDGE_FRONT_GLOSS} />
    </div>
  );
}

function WaveLayer({
  className,
  path,
  fill,
  opacity = 1,
  gloss,
}: {
  className: string;
  path: string;
  fill: string;
  opacity?: number;
  gloss?: string;
}) {
  return (
    <svg
      className={`${className} absolute bottom-0 left-[-6%] h-full w-[112%] max-w-none`}
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
    >
      <path d={path} fill={fill} opacity={opacity} />
      {gloss ? (
        <path
          d={gloss}
          fill="none"
          stroke="rgb(255 255 255 / 0.16)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          transform="translate(0 7)"
        />
      ) : null}
    </svg>
  );
}
