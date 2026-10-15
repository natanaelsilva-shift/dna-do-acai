import { withCatalogProductImages, type CatalogData } from "@/data/menu";

export class CatalogValidationError extends Error {}

function fail(): never { throw new CatalogValidationError("Catálogo inválido. Revise nomes, preços, categorias e limites antes de publicar."); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 500): value is string { return typeof value === "string" && value.length <= max; }
function integer(value: unknown, max = 1_000_000): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max; }
function rows(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) fail();
  const ids = new Set<string>();
  return value.map((item) => {
    const row = record(item);
    if (!text(row.id, 100) || !/^[a-zA-Z0-9_-]+$/.test(row.id) || ids.has(row.id)) fail();
    ids.add(row.id); return row;
  });
}

export function validateCatalog(value: unknown): CatalogData {
  const data = record(value);
  const categories = rows(data.categories, 50);
  const products = rows(data.products, 300);
  const groups = rows(data.complementGroups, 50);
  for (const c of categories) if (!text(c.name, 120) || !c.name.trim() || !text(c.description)) fail();
  for (const p of products) {
    if (!text(p.name, 160) || !p.name.trim() || !text(p.description, 2000) || !integer(p.price) || !text(p.image, 500) || !text(p.imagePosition, 80) ||
      !categories.some((c) => c.id === p.categoryId) || (p.active !== undefined && typeof p.active !== "boolean") ||
      (p.customizable !== undefined && typeof p.customizable !== "boolean") || (p.complementLimit !== undefined && !integer(p.complementLimit, 20)) ||
      (p.originalPrice !== undefined && !integer(p.originalPrice)) ||
      [p.tag, p.serves, p.preparationTime].some((v) => v !== undefined && !text(v, 160))) fail();
    if (p.comboCups !== undefined) for (const cup of rows(p.comboCups, 20)) {
      if (!text(cup.label, 120) || !["300ml", "500ml", "700ml"].includes(String(cup.size)) || (cup.complementLimit !== undefined && !integer(cup.complementLimit, 20)) || (cup.pure !== undefined && typeof cup.pure !== "boolean")) fail();
    }
  }
  for (const group of groups) {
    if (!text(group.title, 160) || !text(group.description) || typeof group.required !== "boolean" || !["single", "multiple"].includes(String(group.type)) ||
      (group.minSelections !== undefined && !integer(group.minSelections, 100)) || (group.maxSelections !== undefined && !integer(group.maxSelections, 100)) ||
      Number(group.minSelections ?? 0) > Number(group.maxSelections ?? 100)) fail();
    for (const option of rows(group.options, 200)) if (!text(option.name, 160) || !option.name.trim() || !integer(option.price) || (option.description !== undefined && !text(option.description))) fail();
  }
  // Mesmas regras da loja: preços da campanha preservados e Nutella removida.
  return withCatalogProductImages({ categories, products, complementGroups: groups } as CatalogData);
}
