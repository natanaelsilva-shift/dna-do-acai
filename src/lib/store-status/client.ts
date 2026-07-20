"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createStoreStatusSnapshot,
  getDefaultStoreStatusPayload,
  isStoreStatus,
  parseStoreStatusSnapshot,
  STORE_STATUS_STORAGE_KEY,
  STORE_STATUS_UPDATED_EVENT,
  type StoreStatus,
  type StoreStatusPayload,
} from "@/data/store-status";

type UseStoreStatusOptions = {
  initialStatus?: StoreStatusPayload;
  poll?: boolean;
};

function subscribeStoreStatus(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORE_STATUS_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORE_STATUS_UPDATED_EVENT, onStoreChange);
  };
}

function persistStoreStatus(payload: StoreStatusPayload) {
  window.localStorage.setItem(
    STORE_STATUS_STORAGE_KEY,
    createStoreStatusSnapshot(payload),
  );
  window.dispatchEvent(new Event(STORE_STATUS_UPDATED_EVENT));
}

function getSnapshotTime(snapshot: string) {
  const parsed = parseStoreStatusSnapshot(snapshot);
  const updatedAt = parsed.updatedAt ? Date.parse(parsed.updatedAt) : 0;

  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

function shouldUseInitialSnapshot(
  storedSnapshot: string,
  initialStatus?: StoreStatusPayload,
) {
  if (!initialStatus) {
    return false;
  }

  if (!storedSnapshot) {
    return true;
  }

  return (
    getSnapshotTime(createStoreStatusSnapshot(initialStatus)) >
    getSnapshotTime(storedSnapshot)
  );
}

async function readStoreStatusResponse(response: Response) {
  const body = (await response.json()) as Partial<StoreStatusPayload> & {
    error?: string;
  };

  if (!response.ok || !isStoreStatus(body.status)) {
    throw new Error(body.error ?? "Nao foi possivel carregar o status da loja.");
  }

  return {
    status: body.status,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
  };
}

export async function fetchStoreStatus() {
  const response = await fetch("/api/store-status", { cache: "no-store" });

  return readStoreStatusResponse(response);
}

export async function setStoreStatus(status: StoreStatus) {
  const response = await fetch("/api/store-status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const payload = await readStoreStatusResponse(response);

  persistStoreStatus(payload);

  return payload;
}

export function useStoreStatus({
  initialStatus,
  poll = false,
}: UseStoreStatusOptions = {}) {
  const getStoreStatusSnapshot = useCallback(() => {
    const storedSnapshot =
      window.localStorage.getItem(STORE_STATUS_STORAGE_KEY) ?? "";

    if (shouldUseInitialSnapshot(storedSnapshot, initialStatus)) {
      return createStoreStatusSnapshot(initialStatus!);
    }

    return storedSnapshot;
  }, [initialStatus]);
  const getStoreStatusServerSnapshot = useCallback(
    () => (initialStatus ? createStoreStatusSnapshot(initialStatus) : ""),
    [initialStatus],
  );
  const snapshot = useSyncExternalStore(
    subscribeStoreStatus,
    getStoreStatusSnapshot,
    getStoreStatusServerSnapshot,
  );
  const storeStatus = useMemo(
    () => parseStoreStatusSnapshot(snapshot),
    [snapshot],
  );

  const refresh = useCallback(async () => {
    const payload = await fetchStoreStatus();
    persistStoreStatus(payload);

    return payload;
  }, []);

  useEffect(() => {
    void refresh().catch(() => {
      if (!snapshot) {
        persistStoreStatus(getDefaultStoreStatusPayload());
      }
    });
  }, [refresh, snapshot]);

  useEffect(() => {
    if (!poll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [poll, refresh]);

  return {
    ...storeStatus,
    refresh,
  };
}
