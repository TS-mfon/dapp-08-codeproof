import Dexie, { type EntityTable } from "dexie";
import type { LifecycleStatus } from "./status";

export type PendingReview = {
  txHash: string;
  account: string;
  mode: "FAST" | "DEEP";
  status: LifecycleStatus;
  createdAt: number;
  reviewId?: string;
  error?: string;
};

export const pendingDb = new Dexie("codeproof") as Dexie & {
  reviews: EntityTable<PendingReview, "txHash">;
};

pendingDb.version(1).stores({
  reviews: "txHash, account, status, createdAt",
});
