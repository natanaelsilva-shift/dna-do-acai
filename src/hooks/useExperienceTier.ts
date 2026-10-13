// Nível da experiência imersiva, decidido uma vez no cliente.
//
// high   — desktop com mouse: intro completa, vídeo, parallax, partículas.
// medium — celular/tablet: intro curta, vídeo só em boa conexão, poucas
//          partículas, sem parallax de mouse.
// low    — reduced motion, economia de dados, aparelho fraco: composição
//          estática premium (pôster), sem vídeo nem partículas.

export type ExperienceTier = "high" | "medium" | "low";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

export function detectExperienceTier(): ExperienceTier {
  if (typeof window === "undefined") {
    return "low";
  }

  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    deviceMemory?: number;
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = nav.connection?.saveData === true;
  const slowNetwork = /(^|-)2g$/.test(nav.connection?.effectiveType ?? "");
  const weakDevice =
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2);

  if (reducedMotion || saveData || slowNetwork || weakDevice) {
    return "low";
  }

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const wide = window.matchMedia("(min-width: 1024px)").matches;

  return finePointer && wide ? "high" : "medium";
}

export function canStreamHeroVideo(tier: ExperienceTier) {
  if (tier === "low") {
    return false;
  }

  if (tier === "high") {
    return true;
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformation })
    .connection;

  // No celular só baixa o vídeo (~2 MB) quando a rede é boa ou desconhecida.
  return !connection?.effectiveType || connection.effectiveType === "4g";
}
