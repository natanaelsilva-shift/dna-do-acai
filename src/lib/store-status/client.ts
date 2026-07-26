"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isStoreStatus,
  type StoreStatus,
  type StoreStatusPayload,
} from "@/data/store-status";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type UseStoreStatusOptions = {
  initialStatus?: StoreStatusPayload;
  poll?: boolean;
};

type StoreStatusRow = {
  id?: unknown;
  status?: unknown;
  updated_at?: unknown;
};

async function readStoreStatusResponse(response: Response) {
  const body = (await response.json()) as Partial<StoreStatusPayload> & {
    error?: string;
  };

  if (!response.ok || !isStoreStatus(body.status)) {
    throw new Error(body.error ?? "Não foi possível carregar o status da loja.");
  }

  return {
    status: body.status,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
  } satisfies StoreStatusPayload;
}

function rowToPayload(row: StoreStatusRow): StoreStatusPayload | null {
  if (!isStoreStatus(row.status)) {
    return null;
  }

  return {
    status: row.status,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function payloadTime(payload: StoreStatusPayload) {
  const parsed = payload.updatedAt ? Date.parse(payload.updatedAt) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchStoreStatus() {
  const response = await fetch("/api/store-status", {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  return readStoreStatusResponse(response);
}

export async function setStoreStatus(status: StoreStatus) {
  const response = await fetch("/api/store-status", {
    method: "PATCH",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({ status }),
  });

  return readStoreStatusResponse(response);
}

export function useStoreStatus({
  initialStatus,
  poll = false,
}: UseStoreStatusOptions = {}) {
  const [storeStatus, setStoreStatusState] = useState<StoreStatusPayload | null>(
    initialStatus ?? null,
  );
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const mountedRef = useRef(true);
  const refreshPromiseRef = useRef<Promise<StoreStatusPayload> | null>(null);

  const applyDatabaseStatus = useCallback((payload: StoreStatusPayload) => {
    setStoreStatusState((current) => {
      if (current && payloadTime(payload) < payloadTime(current)) {
        return current;
      }

      return current &&
        payload.status === current.status &&
        payload.updatedAt === current.updatedAt
        ? current
        : payload;
    });
  }, []);

  const refresh = useCallback(() => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const request = fetchStoreStatus()
      .then((payload) => {
        if (mountedRef.current) {
          applyDatabaseStatus(payload);
          setError("");
        }
        return payload;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = request;
    return request;
  }, [applyDatabaseStatus]);

  const update = useCallback(
    async (status: StoreStatus) => {
      setIsUpdating(true);
      setError("");

      try {
        const payload = await setStoreStatus(status);
        if (mountedRef.current) {
          applyDatabaseStatus(payload);
        }
        return payload;
      } catch (updateError) {
        const message =
          updateError instanceof Error
            ? updateError.message
            : "Não foi possível atualizar o status da loja.";
        if (mountedRef.current) {
          setError(message);
        }
        throw updateError;
      } finally {
        if (mountedRef.current) {
          setIsUpdating(false);
        }
      }
    },
    [applyDatabaseStatus],
  );

  useEffect(() => {
    mountedRef.current = true;
    void refresh().catch((refreshError) => {
      if (mountedRef.current) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Não foi possível carregar o status da loja.",
        );
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!poll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 2000);
    const handleFocus = () => void refresh().catch(() => undefined);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [poll, refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`store-status-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_settings",
          filter: "id=eq.main",
        },
        (event) => {
          const payload = rowToPayload(event.new as StoreStatusRow);
          if (payload && mountedRef.current) {
            applyDatabaseStatus(payload);
            setError("");
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyDatabaseStatus]);

  return {
    status: storeStatus?.status ?? null,
    updatedAt: storeStatus?.updatedAt ?? null,
    isLoaded: storeStatus !== null,
    error,
    isUpdating,
    refresh,
    setStatus: update,
  };
}
