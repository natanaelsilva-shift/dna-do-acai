"use client";

import { useEffect, useRef } from "react";
import { createPowderField, type PowderField } from "@/animations/powder";
import { heroAssets, ingredientCues } from "@/data/experience";
import {
  canStreamHeroVideo,
  detectExperienceTier,
  type ExperienceTier,
} from "@/hooks/useExperienceTier";

// Experiência visual de abertura: copo, montagem, luz, partículas, parallax e
// continuidade de scroll até "Seu açaí. Suas regras.". Não conhece carrinho,
// checkout, pedidos nem Supabase — só aponta para âncoras da página.
//
// Camadas do copo (cada uma animada por um único sistema):
//   .ax-cup-move  → scroll (ScrollTrigger)
//   .ax-cup-par   → parallax do mouse
//   .ax-cup-float → flutuação ociosa
//   .ax-cup       → entrada da intro

const INTRO_SEEN_KEY = "dna-intro-seen";

// Linha do título escondida abaixo da máscara até o scroll revelar. Usa
// transform inline (e não a utility translate-y) para o GSAP assumir.
const hiddenLine = { transform: "translateY(140%)" } as const;

export function AcaiExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!root || !video || !canvas) {
      return;
    }

    const tier: ExperienceTier = detectExperienceTier();
    root.dataset.tier = tier;

    let cancelled = false;
    let revert: (() => void) | undefined;
    let powder: PowderField | undefined;
    let inView = true;
    let videoRequested = false;

    function requestVideo() {
      if (videoRequested || !video || !canStreamHeroVideo(tier)) {
        return;
      }

      videoRequested = true;
      if (heroAssets.video.webm) {
        const webm = document.createElement("source");
        webm.src = heroAssets.video.webm;
        webm.type = "video/webm";
        video.appendChild(webm);
      }
      const mp4 = document.createElement("source");
      mp4.src = heroAssets.video.mp4;
      mp4.type = "video/mp4";
      video.appendChild(mp4);
      video.load();
      void video.play().catch(() => undefined);
    }

    const visibility = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        powder?.setVisible(inView);
        if (!videoRequested) return;
        if (inView && document.visibilityState === "visible") {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.01 },
    );
    visibility.observe(root);

    function handleVisibilityChange() {
      if (!videoRequested) return;
      if (document.visibilityState === "visible" && inView) {
        void video?.play().catch(() => undefined);
      } else {
        video?.pause();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (tier !== "low") {
      powder = createPowderField(canvas);
    }

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      if (cancelled) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      const html = document.documentElement;
      const isMobile = !window.matchMedia("(min-width: 1024px)").matches;
      let seenIntro = false;
      try {
        seenIntro = window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
        window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
      } catch {
        // sessionStorage indisponível: roda a intro normalmente.
      }

      const context = gsap.context(() => {
        const q = gsap.utils.selector(root);

        video.addEventListener(
          "playing",
          () => gsap.to(video, { autoAlpha: 1, duration: 1.2, ease: "power2.out" }),
          { once: true },
        );

        // ---------- Intro ----------
        if (tier === "low") {
          gsap.set(q(".ax-intro"), { autoAlpha: 1 });
          // Sem montagem animada, as deixas não têm função e cobririam o slogan.
          gsap.set(q(".ax-cue"), { autoAlpha: 0 });
          gsap.set(q(".ax-line-inner"), { color: "var(--color-dna-cream)" });
          html.classList.remove("dna-intro-pending");
        } else {
          gsap.set(q(".ax-intro"), { autoAlpha: 0 });
          html.classList.remove("dna-intro-pending");

          const pace = isMobile ? 0.72 : 1;
          const cueTargets = q(".ax-cue").sort(
            (a, b) => Number(a.dataset.order) - Number(b.dataset.order),
          );
          const intro = gsap.timeline({
            defaults: { ease: "power3.out" },
            onComplete: () => {
              gsap.to(q(".ax-cup-float"), {
                y: -8,
                duration: 3.2,
                ease: "sine.inOut",
                repeat: -1,
                yoyo: true,
              });
              if (tier === "high") {
                powder?.suspend(18);
              }
            },
          });

          intro
            .fromTo(
              q(".ax-stage"),
              { scale: 1.06 },
              { scale: 1, duration: 3.4 * pace, ease: "power2.out" },
              0,
            )
            .fromTo(
              q(".ax-bloom"),
              { autoAlpha: 0, scale: 0.55 },
              { autoAlpha: 1, scale: 1, duration: 1.4 * pace },
              0,
            )
            .fromTo(
              q(".ax-rim"),
              { autoAlpha: 0 },
              { autoAlpha: 1, duration: 1.2 * pace },
              0.25 * pace,
            )
            .fromTo(
              q(".ax-cup"),
              // O copo já está pintado (escuro e desfocado) desde o primeiro
              // frame: o LCP não espera o JS. A intro só o revela.
              { y: 40, scale: 0.94, filter: "blur(14px) brightness(0.35)" },
              {
                y: 0,
                scale: 1,
                filter: "blur(0px) brightness(1)",
                duration: 1.2 * pace,
                clearProps: "filter",
              },
              0.35 * pace,
            );

          // Montagem: cada complemento entra na ordem do cardápio. Quando o
          // recorte fotográfico existir, ele cai no copo junto com a deixa.
          cueTargets.forEach((cue, index) => {
            const at = (1 + index * 0.24) * pace;
            const fromLeft = cue.dataset.side === "left";
            intro.fromTo(
              cue,
              { autoAlpha: 0, x: fromLeft ? -18 : 18 },
              { autoAlpha: 1, x: 0, duration: 0.6 * pace },
              at,
            );
            const drop = cue.querySelector<HTMLElement>(".ax-drop");
            if (drop) {
              intro.fromTo(
                drop,
                { autoAlpha: 0, yPercent: -260, rotation: fromLeft ? -24 : 24 },
                { autoAlpha: 1, yPercent: 0, rotation: 0, duration: 0.7, ease: "power2.in" },
                at,
              );
            }
            if (cue.dataset.particles === "true" && powder) {
              intro.call(() => powder?.burst(0.5, 0.3, tier === "high" ? 140 : 48), [], at);
            }
          });

          const afterCues = (1 + cueTargets.length * 0.24) * pace;
          intro
            .call(requestVideo, [], 1.4 * pace)
            .fromTo(
              q(".ax-brand"),
              { autoAlpha: 0, yPercent: 100 },
              { autoAlpha: 1, yPercent: 0, duration: 0.7 },
              afterCues,
            )
            .fromTo(
              q(".ax-line-inner"),
              { color: "rgb(246 240 230 / 0.1)" },
              {
                color: "rgb(246 240 230 / 1)",
                duration: 0.9,
                stagger: 0.18,
                ease: "power2.inOut",
              },
              afterCues + 0.1,
            )
            // As deixas cumprem o papel na montagem e saem quando o slogan acende.
            .to(
              cueTargets,
              { autoAlpha: 0, duration: 0.6, stagger: 0.04, ease: "power2.in" },
              afterCues,
            )
            .fromTo(
              q(".ax-desc, .ax-cta"),
              { autoAlpha: 0, y: 18 },
              { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 },
              afterCues + 0.45,
            );

          if (seenIntro) {
            intro.timeScale(3.5);
          }
        }

        if (tier !== "high" && tier !== "low") {
          requestVideo();
        }

        // ---------- Parallax do mouse (somente desktop) ----------
        if (tier === "high") {
          const cupX = gsap.quickTo(q(".ax-cup-par"), "x", { duration: 0.9, ease: "power3.out" });
          const cupY = gsap.quickTo(q(".ax-cup-par"), "y", { duration: 0.9, ease: "power3.out" });
          const cupR = gsap.quickTo(q(".ax-cup-par"), "rotation", { duration: 1.2, ease: "power3.out" });
          const cuesX = gsap.quickTo(q(".ax-cues-par"), "x", { duration: 1.1, ease: "power3.out" });
          const cuesY = gsap.quickTo(q(".ax-cues-par"), "y", { duration: 1.1, ease: "power3.out" });
          const bloomX = gsap.quickTo(q(".ax-bloom-par"), "x", { duration: 1.6, ease: "power2.out" });
          const bloomY = gsap.quickTo(q(".ax-bloom-par"), "y", { duration: 1.6, ease: "power2.out" });

          const handlePointerMove = (event: PointerEvent) => {
            if (!inView || window.scrollY > window.innerHeight * 0.6) return;
            const nx = event.clientX / window.innerWidth - 0.5;
            const ny = event.clientY / window.innerHeight - 0.5;
            cupX(nx * 18);
            cupY(ny * 12);
            cupR(nx * 1.6);
            cuesX(nx * -34);
            cuesY(ny * -20);
            bloomX(nx * 60);
            bloomY(ny * 40);
          };

          root.addEventListener("pointermove", handlePointerMove);
          return () => root.removeEventListener("pointermove", handlePointerMove);
        }
      }, root);

      // ---------- Continuidade de scroll ----------
      const media = gsap.matchMedia();
      media.add(
        {
          desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
        },
        (mediaContext) => {
          const { desktop } = mediaContext.conditions as { desktop: boolean; mobile: boolean };
          const q = gsap.utils.selector(root);
          const scroll = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.6,
            },
          });

          scroll
            .to(q(".ax-s-line-a"), { yPercent: -70, autoAlpha: 0, duration: 0.3 }, 0)
            .to(q(".ax-s-line-b"), { yPercent: 70, autoAlpha: 0, duration: 0.3 }, 0)
            .to(q(".ax-s-copy, .ax-s-brand"), { autoAlpha: 0, y: -24, duration: 0.2 }, 0)
            .to(q(".ax-s-cue-left"), { x: -80, autoAlpha: 0, duration: 0.3 }, 0.05)
            .to(q(".ax-s-cue-right"), { x: 80, autoAlpha: 0, duration: 0.3 }, 0.05)
            .to(q(".ax-cup-move"), { scale: desktop ? 1.14 : 1.08, duration: 0.3 }, 0);

          if (desktop) {
            scroll.to(
              q(".ax-cup-move"),
              { x: () => window.innerWidth * 0.21, scale: 1.02, duration: 0.35 },
              0.3,
            );
          } else {
            scroll.to(
              q(".ax-cup-move"),
              { y: () => -window.innerHeight * 0.17, scale: 0.74, duration: 0.35 },
              0.3,
            );
          }

          scroll
            .fromTo(
              q(".ax-rules-line"),
              { yPercent: 140, y: 0 },
              { yPercent: 0, y: 0, duration: 0.2, stagger: 0.05 },
              0.42,
            )
            .fromTo(
              q(".ax-rules-copy"),
              { autoAlpha: 0, y: 24 },
              { autoAlpha: 1, y: 0, duration: 0.15, stagger: 0.04 },
              0.55,
            )
            // O copo afunda na onda DNA que vem a seguir.
            .to(
              q(".ax-cup-move"),
              { y: () => window.innerHeight * (desktop ? 0.1 : 0.04), duration: 0.25 },
              0.75,
            )
            .to(q(".ax-bloom-par"), { autoAlpha: 0.35, duration: 0.25 }, 0.75);
        },
      );

      revert = () => {
        context.revert();
        media.revert();
      };
    })();

    return () => {
      cancelled = true;
      revert?.();
      powder?.destroy();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const leftCues = ingredientCues.filter((_, index) => index % 2 === 0);
  const rightCues = ingredientCues.filter((_, index) => index % 2 === 1);

  return (
    <section
      ref={rootRef}
      id="inicio"
      aria-labelledby="hero-title"
      className="ax-root relative h-[250svh] bg-dna-night motion-reduce:h-auto"
    >
      <div className="ax-stage-frame sticky top-0 h-svh min-h-[560px] overflow-hidden motion-reduce:static">
        <div className="ax-stage absolute inset-0">
          {/* Luz */}
          <div className="ax-bloom-par absolute inset-0" aria-hidden="true">
            <div className="ax-bloom ax-intro absolute left-1/2 top-[48%] size-[min(120vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(109_42_122/0.75)_0%,rgb(75_22_76/0.45)_32%,transparent_68%)]" />
          </div>
          <div
            className="ax-rim ax-intro absolute inset-x-0 bottom-0 h-[45%] bg-[radial-gradient(60%_80%_at_50%_100%,rgb(47_125_79/0.28)_0%,transparent_70%)]"
            aria-hidden="true"
          />

          {/* Slogan — visível desde o primeiro paint (LCP), "acende" na intro */}
          <h1 id="hero-title" className="contents">
            <span className="ax-s-brand absolute inset-x-0 top-[calc(4.5rem+3svh)] z-20 flex justify-center overflow-hidden lg:top-[calc(5rem+4svh)]">
              <span className="ax-brand ax-intro block text-sm font-semibold tracking-[0.02em] text-dna-orchid sm:text-base">
                DNA do Açaí
              </span>
            </span>
            <span className="ax-s-line-a absolute inset-x-0 top-[calc(6.5rem+5svh)] z-0 block text-center lg:top-[calc(7rem+6svh)]">
              <span className="ax-line-inner dna-display block text-[clamp(3rem,14vw,5.5rem)] lg:text-[clamp(5rem,11.5vw,12.5rem)] uppercase">
                Açaí de verdade,
              </span>
            </span>
            <span className="ax-s-line-b absolute inset-x-0 bottom-[calc(10.5rem+6svh)] z-30 block text-center lg:bottom-[calc(6rem+9svh)]">
              <span className="ax-line-inner dna-display block text-[clamp(3rem,14vw,5.5rem)] lg:text-[clamp(5rem,11.5vw,12.5rem)] uppercase [text-shadow:0_20px_60px_rgb(26_10_31/0.6)]">
                do seu jeito.
              </span>
            </span>
          </h1>

          {/* Copo */}
          <div className="ax-cup-move absolute left-1/2 top-[47%] z-10 h-[min(50svh,560px)] -translate-x-1/2 -translate-y-1/2 lg:top-1/2 lg:h-[min(76svh,880px)]">
            <div className="ax-cup-par relative h-full">
              <div className="ax-cup-float relative h-full">
                <div className="ax-cup relative aspect-[9/16] h-full">
                  <div className="ax-cup-mask absolute inset-0">
                    <picture>
                      <source
                        type="image/avif"
                        srcSet={`${heroAssets.poster.avifSmall} 480w, ${heroAssets.poster.avif} 720w`}
                        sizes="(min-width: 1024px) 495px, 290px"
                      />
                      <source
                        type="image/webp"
                        srcSet={`${heroAssets.poster.webpSmall} 480w, ${heroAssets.poster.webp} 720w`}
                        sizes="(min-width: 1024px) 495px, 290px"
                      />
                      <img
                        src={heroAssets.poster.webp}
                        width={heroAssets.poster.width}
                        height={heroAssets.poster.height}
                        alt="Copo de açaí DNA do Açaí com leite condensado e morango"
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 size-full object-cover"
                      />
                    </picture>
                    <video
                      ref={videoRef}
                      muted
                      loop
                      playsInline
                      preload="none"
                      aria-hidden="true"
                      tabIndex={-1}
                      className="absolute inset-0 size-full object-cover opacity-0"
                    />
                  </div>
                  <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[-25%] top-[-20%] h-[120%] w-[150%]"
                  />

                  {/* Montagem: complementos reais do cardápio */}
                  <div className="ax-cues-par pointer-events-none absolute inset-0" aria-hidden="true">
                    <CueColumn cues={leftCues} side="left" />
                    <CueColumn cues={rightCues} side="right" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Descrição e CTAs */}
          <div className="ax-s-copy absolute inset-x-0 bottom-0 z-40 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:pb-10">
            <div className="dna-shell flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <p className="ax-desc ax-intro dna-lede text-center text-dna-cream/80 max-lg:mx-auto max-lg:text-[0.95rem] lg:text-left">
                Monte sua combinação favorita e transforme cada copo em uma
                experiência única.
              </p>
              <div className="ax-cta ax-intro grid grid-cols-2 gap-3 sm:flex sm:justify-center">
                <a href="#monte" className="dna-btn dna-btn-primary">
                  Monte o seu
                </a>
                <a href="#cardapio" className="dna-btn dna-btn-ghost">
                  Ver cardápio
                </a>
              </div>
            </div>
          </div>

          {/* Continuidade: Seu açaí. Suas regras. */}
          <div className="ax-rules pointer-events-none absolute inset-0 z-20 flex items-end pb-[12svh] lg:items-center lg:pb-0 motion-reduce:hidden">
            <div className="dna-shell">
              <div className="pointer-events-auto max-w-xl max-lg:text-center lg:max-w-[44%]">
                <h2 className="dna-display text-[clamp(2.75rem,7vw,7rem)] uppercase">
                  <span className="block overflow-hidden pt-[0.12em]">
                    <span className="ax-rules-line block" style={hiddenLine}>
                      Seu açaí.
                    </span>
                  </span>
                  <span className="block overflow-hidden pt-[0.12em]">
                    <span className="ax-rules-line block text-dna-sprout" style={hiddenLine}>
                      Suas regras.
                    </span>
                  </span>
                </h2>
                <p className="ax-rules-copy mt-5 text-lg leading-snug text-dna-cream/80 opacity-0 lg:mt-7 lg:text-2xl">
                  Escolha o tamanho.
                  <br />
                  Monte sua combinação.
                  <br />A gente prepara.
                </p>
                <a
                  href="#monte"
                  className="ax-rules-copy dna-btn dna-btn-cream mt-6 opacity-0 lg:mt-8"
                >
                  Começar a montar
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Versão sem movimento: o mesmo conteúdo, em fluxo normal */}
      <div className="hidden motion-reduce:block">
        <div className="dna-shell py-section">
          <h2 className="dna-display text-[clamp(2.75rem,7vw,7rem)] uppercase">
            Seu açaí. <span className="text-dna-sprout">Suas regras.</span>
          </h2>
          <p className="mt-5 text-lg text-dna-cream/80">
            Escolha o tamanho. Monte sua combinação. A gente prepara.
          </p>
        </div>
      </div>
    </section>
  );
}

function CueColumn({
  cues,
  side,
}: {
  cues: typeof ingredientCues;
  side: "left" | "right";
}) {
  return (
    <ul
      className={`ax-s-cue-${side} absolute top-[16%] flex h-[62%] flex-col justify-between ${
        side === "left"
          ? "right-[calc(100%-0.5rem)] items-end text-right"
          : "left-[calc(100%-0.5rem)] items-start text-left"
      }`}
    >
      {cues.map((cue) => (
        <li
          key={cue.id}
          className="ax-cue ax-intro relative flex items-center gap-2"
          data-side={side}
          data-order={ingredientCues.indexOf(cue)}
          data-particles={cue.particles ? "true" : undefined}
        >
          {side === "right" ? <CueTick /> : null}
          <span className="max-w-[5.5rem] text-[0.7rem] font-semibold leading-tight text-dna-cream/85 sm:max-w-none sm:text-sm lg:text-base">
            {cue.label}
          </span>
          {side === "left" ? <CueTick /> : null}
          {cue.asset ? (
            // eslint-disable-next-line @next/next/no-img-element -- recorte fotográfico do manifesto
            <img
              src={cue.asset.src}
              width={cue.asset.width}
              height={cue.asset.height}
              alt=""
              className="ax-drop absolute left-1/2 top-0 w-16 -translate-x-1/2"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CueTick() {
  return (
    <span className="flex items-center" aria-hidden="true">
      <span className="h-px w-5 bg-dna-cream/35 lg:w-10" />
      <span className="size-1.5 rounded-full bg-dna-sprout" />
    </span>
  );
}
