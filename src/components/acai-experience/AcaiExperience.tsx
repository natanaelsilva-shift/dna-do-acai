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
          gsap.set(q(".ax-line-inner"), { color: "var(--color-dna-cream)" });
          html.classList.remove("dna-intro-pending");
        } else {
          gsap.set(q(".ax-intro"), { autoAlpha: 0 });
          html.classList.remove("dna-intro-pending");

          const pace = isMobile ? 0.72 : 1;
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

          // Montagem dentro do copo: recortes fotográficos dos complementos (quando
          // existirem no manifesto) e a nuvem de leite em pó.
          const montageAt = 1 * pace;
          q(".ax-drop").forEach((drop, index) => {
            intro.fromTo(
              drop,
              { autoAlpha: 0, yPercent: -260, rotation: index % 2 ? 24 : -24 },
              { autoAlpha: 1, yPercent: 0, rotation: 0, duration: 0.7, ease: "power2.in" },
              montageAt + index * 0.24 * pace,
            );
          });
          if (powder) {
            intro.call(() => powder?.burst(0.5, 0.3, tier === "high" ? 140 : 48), [], montageAt + 0.4 * pace);
          }

          // A frase é o foco principal: acende logo depois que o copo aparece.
          const afterMontage = 1.5 * pace;
          intro
            .call(requestVideo, [], 1.4 * pace)
            .fromTo(
              q(".ax-brand"),
              { autoAlpha: 0, yPercent: 100 },
              { autoAlpha: 1, yPercent: 0, duration: 0.7 },
              afterMontage,
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
              afterMontage + 0.1,
            )
            .fromTo(
              q(".ax-desc, .ax-cta"),
              { autoAlpha: 0, y: 18 },
              { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 },
              afterMontage + 0.45,
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
          const bloomX = gsap.quickTo(q(".ax-bloom-par"), "x", { duration: 1.6, ease: "power2.out" });
          const bloomY = gsap.quickTo(q(".ax-bloom-par"), "y", { duration: 1.6, ease: "power2.out" });

          const handlePointerMove = (event: PointerEvent) => {
            if (!inView || window.scrollY > window.innerHeight * 0.6) return;
            const nx = event.clientX / window.innerWidth - 0.5;
            const ny = event.clientY / window.innerHeight - 0.5;
            cupX(nx * 18);
            cupY(ny * 12);
            cupR(nx * 1.6);
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
              { y: () => -window.innerHeight * 0.06, scale: 0.62, duration: 0.35 },
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
            <div className="ax-bloom ax-intro absolute left-1/2 top-[38%] size-[min(120vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(109_42_122/0.75)_0%,rgb(75_22_76/0.45)_32%,transparent_68%)]" />
          </div>
          <div
            className="ax-rim ax-intro absolute inset-x-0 bottom-0 h-[45%] bg-[radial-gradient(60%_80%_at_50%_100%,rgb(47_125_79/0.28)_0%,transparent_70%)]"
            aria-hidden="true"
          />

          {/*
            Composição em coluna. Ordem visual (flex `order`): marca → copo →
            frase → complementos → CTAs. Ordem no DOM: h1 primeiro, para a frase
            ser lida antes de tudo. O copo ocupa o espaço que sobrar e só a base
            esfumaçada dele encosta no topo da frase (que fica atrás).
          */}
          <div className="ax-layout relative flex h-full flex-col items-center justify-center pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(4rem+2svh)] lg:pb-8 lg:pt-[calc(5rem+2svh)]">
            {/* Slogan — visível desde o primeiro paint, "acende" na intro */}
            <h1 id="hero-title" className="contents">
              <span className="ax-s-brand order-1 flex shrink-0 justify-center overflow-hidden">
                <span className="ax-brand ax-intro block text-sm font-semibold tracking-[0.02em] text-dna-orchid sm:text-base">
                  DNA do Açaí
                </span>
              </span>
              <span className="ax-s-line-a relative z-0 order-3 -mt-[6svh] block w-full shrink-0 text-center lg:-mt-[9svh]">
                <span className="ax-line-inner dna-display block text-[clamp(2.6rem,14vw,5.5rem)] uppercase lg:text-[min(9vw,13.5svh)]">
                  Açaí de verdade,
                </span>
              </span>
              <span className="ax-s-line-b relative z-0 order-4 block w-full shrink-0 text-center">
                <span className="ax-line-inner dna-display block text-[clamp(2.6rem,14vw,5.5rem)] uppercase [text-shadow:0_20px_60px_rgb(26_10_31/0.6)] lg:text-[min(9vw,13.5svh)]">
                  do seu jeito.
                </span>
              </span>
            </h1>

            {/* Copo */}
            <div className="relative z-10 order-2 mt-[1svh] max-h-[46svh] w-full min-h-0 flex-1 lg:max-h-none">
              <div className="ax-cup-move relative mx-auto h-full w-fit">
                <div className="ax-cup-par relative h-full">
                  <div className="ax-cup-float relative h-full">
                    <div className="ax-cup relative aspect-[9/16] h-full">
                      <div className="ax-cup-mask absolute inset-0">
                        <picture>
                          <source
                            type="image/avif"
                            srcSet={`${heroAssets.poster.avifSmall} 480w, ${heroAssets.poster.avif} 720w`}
                            sizes="(min-width: 1024px) 380px, 260px"
                          />
                          <source
                            type="image/webp"
                            srcSet={`${heroAssets.poster.webpSmall} 480w, ${heroAssets.poster.webp} 720w`}
                            sizes="(min-width: 1024px) 380px, 260px"
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
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="none"
                          poster={heroAssets.poster.webp}
                          onError={(event) => { event.currentTarget.style.opacity = "0"; }}
                          aria-hidden="true"
                          tabIndex={-1}
                          className="absolute inset-0 size-full object-cover opacity-0"
                        />
                      </div>
                      <canvas
                        ref={canvasRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-[-25%] top-[-20%] h-[120%] w-[150%] max-w-none"
                      />
                      {/* Recortes fotográficos dos complementos caem dentro do copo */}
                      <div className="pointer-events-none absolute inset-x-0 top-[8%]" aria-hidden="true">
                        {ingredientCues
                          .filter((cue) => cue.asset)
                          .map((cue) => (
                            // eslint-disable-next-line @next/next/no-img-element -- recorte fotográfico do manifesto
                            <img
                              key={cue.id}
                              data-cue={cue.id}
                              src={cue.asset!.src}
                              width={cue.asset!.width}
                              height={cue.asset!.height}
                              alt=""
                              className="ax-drop absolute left-1/2 top-0 w-1/3 -translate-x-1/2"
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subtítulo e CTAs — centralizados abaixo da frase */}
            <div className="ax-s-copy relative z-20 order-5 mt-[2.5svh] w-full shrink-0 lg:mt-[3svh]">
              <div className="dna-shell flex flex-col items-center gap-5 text-center lg:gap-6">
                <p className="ax-desc ax-intro dna-lede mx-auto max-w-[40ch] text-dna-cream/80 max-lg:text-[0.95rem] [@media(max-height:820px)]:hidden">
                  Monte sua combinação favorita e transforme cada copo em uma
                  experiência única.
                </p>
                <div className="ax-cta ax-intro grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:justify-center">
                  <a href="#monte" className="dna-btn dna-btn-primary">
                    Monte o seu
                  </a>
                  <a href="#cardapio" className="dna-btn dna-btn-ghost">
                    Ver cardápio
                  </a>
                </div>
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
