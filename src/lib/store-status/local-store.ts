import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_STORE_STATUS,
  isStoreStatus,
  type StoreStatus,
  type StoreStatusPayload,
} from "@/data/store-status";

const localStoreStatusPath = path.join(
  process.cwd(),
  "local-data",
  "store-status.json",
);

export async function getLocalStoreStatus(): Promise<StoreStatusPayload> {
  try {
    const file = await readFile(localStoreStatusPath, "utf8");
    const data = JSON.parse(file) as Partial<StoreStatusPayload>;

    return {
      status: isStoreStatus(data.status) ? data.status : DEFAULT_STORE_STATUS,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    };
  } catch {
    return {
      status: DEFAULT_STORE_STATUS,
      updatedAt: null,
    };
  }
}

export async function updateLocalStoreStatus(status: StoreStatus) {
  const data: StoreStatusPayload = {
    status,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(localStoreStatusPath), { recursive: true });
  await writeFile(localStoreStatusPath, JSON.stringify(data, null, 2), "utf8");

  return data;
}
