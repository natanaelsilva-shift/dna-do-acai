"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getCatalogStorageSnapshot,
  migrateLegacyCatalogStorage,
  parseCatalogStorageSnapshot,
} from "@/data/menu";

// Única porta de entrada do catálogo no frontend. Hoje lê `menu.ts` + o
// snapshot do localStorage; ao migrar o catálogo para o Supabase, só este
// hook precisa mudar.

function subscribeCatalogStore(onStoreChange: () => void) {
  if (migrateLegacyCatalogStorage()) {
    queueMicrotask(onStoreChange);
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("dna-catalog-updated", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("dna-catalog-updated", onStoreChange);
  };
}

function getCatalogServerSnapshot() {
  return "";
}

export function useCatalog() {
  const catalogSnapshot = useSyncExternalStore(
    subscribeCatalogStore,
    getCatalogStorageSnapshot,
    getCatalogServerSnapshot,
  );
  const catalog = useMemo(
    () => parseCatalogStorageSnapshot(catalogSnapshot),
    [catalogSnapshot],
  );
  const products = useMemo(
    () => catalog.products.filter((product) => product.active !== false),
    [catalog.products],
  );

  return {
    catalog,
    categories: catalog.categories,
    complementGroups: catalog.complementGroups,
    products,
  };
}
