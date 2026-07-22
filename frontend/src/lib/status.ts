export const reviewStatuses = [
  "Created",
  "Source fetched",
  "AI requested",
  "Completed",
  "Failed",
  "Expired",
  "Cancelled",
] as const;

export const lifecycle = [
  "SUBMITTING",
  "PENDING_COMMITMENT",
  "COMMITTED",
  "EXECUTOR_PROCESSING",
  "RESULT_READY",
  "PENDING_SETTLEMENT",
  "SETTLED",
  "FAILED",
  "EXPIRED",
] as const;

export type LifecycleStatus = (typeof lifecycle)[number];

export function statusTone(status: number | LifecycleStatus) {
  if (status === 3 || status === "SETTLED") return "success";
  if (
    status === 4 ||
    status === 5 ||
    status === 6 ||
    status === "FAILED" ||
    status === "EXPIRED"
  )
    return "danger";
  if (status === 2 || status === "EXECUTOR_PROCESSING") return "ai";
  return "pending";
}
