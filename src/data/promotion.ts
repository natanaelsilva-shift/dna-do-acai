// Campanha única, em UTC. Nunca calcular o início na abertura do site ou no deploy.
// Valores em centavos, como todo o catálogo existente.
export const PROMOTION_DURATION_MS = 72 * 60 * 60 * 1000;
const startAt = "2026-10-14T18:52:22.000Z";

export const promotion = {
  startAt,
  endAt: new Date(Date.parse(startAt) + PROMOTION_DURATION_MS).toISOString(),
  prices: {
    "dna-explosao-300ml": 1299,
    "dna-supremo-500ml": 1899,
    "dna-extra-supremo-700ml": 2599,
    "copo-acai-puro-300ml": 1199,
    "copo-acai-puro-500ml": 1699,
    "copo-acai-puro-700ml": 2299,
  } as Readonly<Record<string, number>>,
};

export type PromotionWindow = { startAt: string; endAt: string };

// Overrides de teste só funcionam em `next dev`; builds de produção os ignoram.
export function getPromotionWindow(): PromotionWindow {
  if (process.env.NODE_ENV === "development") {
    const start = process.env.NEXT_PUBLIC_DNA_PROMOTION_TEST_START_AT;
    const end = process.env.NEXT_PUBLIC_DNA_PROMOTION_TEST_END_AT;
    if (start && end && /(?:Z|[+-]\d{2}:\d{2})$/.test(start) &&
        /(?:Z|[+-]\d{2}:\d{2})$/.test(end) && Date.parse(end) > Date.parse(start)) {
      return { startAt: start, endAt: end };
    }
  }
  return { startAt: promotion.startAt, endAt: promotion.endAt };
}
