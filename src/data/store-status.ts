export type StoreStatus = "open" | "closed";

export type StoreStatusPayload = {
  status: StoreStatus;
  updatedAt: string | null;
};

export const DEFAULT_STORE_STATUS: StoreStatus = "open";
export const STORE_STATUS_STORAGE_KEY = "dna-do-acai-store-status-v1";
export const STORE_STATUS_UPDATED_EVENT = "dna-store-status-updated";

export function isStoreStatus(value: unknown): value is StoreStatus {
  return value === "open" || value === "closed";
}

export function getStoreStatusLabel(status: StoreStatus) {
  return status === "open" ? "Loja aberta" : "Loja fechada";
}

export function getDefaultStoreStatusPayload(): StoreStatusPayload {
  return {
    status: DEFAULT_STORE_STATUS,
    updatedAt: null,
  };
}

export function parseStoreStatusSnapshot(snapshot: string | null | undefined) {
  if (!snapshot) {
    return getDefaultStoreStatusPayload();
  }

  if (isStoreStatus(snapshot)) {
    return {
      status: snapshot,
      updatedAt: null,
    };
  }

  try {
    const data = JSON.parse(snapshot) as Partial<StoreStatusPayload>;

    if (isStoreStatus(data.status)) {
      return {
        status: data.status,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      };
    }
  } catch {
    return getDefaultStoreStatusPayload();
  }

  return getDefaultStoreStatusPayload();
}

export function createStoreStatusSnapshot(payload: StoreStatusPayload) {
  return JSON.stringify(payload);
}
