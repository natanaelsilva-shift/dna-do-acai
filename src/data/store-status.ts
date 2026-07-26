export type StoreStatus = "open" | "closed";

export type StoreStatusPayload = {
  status: StoreStatus;
  updatedAt: string | null;
};

export const DEFAULT_STORE_STATUS: StoreStatus = "open";

export function isStoreStatus(value: unknown): value is StoreStatus {
  return value === "open" || value === "closed";
}

export function getStoreStatusLabel(status: StoreStatus | null | undefined) {
  if (status === "open") return "Loja aberta";
  if (status === "closed") return "Loja fechada";
  return "Status indisponível";
}

export function getDefaultStoreStatusPayload(): StoreStatusPayload {
  return {
    status: DEFAULT_STORE_STATUS,
    updatedAt: null,
  };
}
