"use client";

import { useMemo, useSyncExternalStore } from "react";
import { initialCatalog, type CatalogData } from "@/data/menu";
import { validateCatalog } from "@/lib/catalog/validation";

type Snapshot = { catalog: CatalogData; error: string; loaded: boolean };
const serverSnapshot: Snapshot = { catalog: initialCatalog, error: "", loaded: false };
let snapshot = serverSnapshot;
let pending: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function refreshCatalog() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      if (!response.ok) throw new Error();
      snapshot = { catalog: validateCatalog(data.catalog), error: "", loaded: true };
    } catch {
      snapshot = { ...snapshot, loaded: false, error: "Não foi possível atualizar o cardápio. Tente novamente em instantes." };
    } finally { pending = null; emit(); }
  })();
  return pending;
}
function onFocus() { void refreshCatalog(); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshCatalog();
    timer = setInterval(onFocus, 30_000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("dna-catalog-published", onFocus);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dna-catalog-published", onFocus);
    }
  };
}
export function useCatalog() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  const products = useMemo(() => state.catalog.products.filter((product) => product.active !== false), [state.catalog]);
  return { ...state, categories: state.catalog.categories, complementGroups: state.catalog.complementGroups, products };
}
