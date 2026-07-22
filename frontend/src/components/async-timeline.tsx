import { lifecycle, type LifecycleStatus } from "@/lib/status";

export function AsyncTimeline({ status }: { status: LifecycleStatus }) {
  const current = lifecycle.indexOf(status);
  const terminalFailure = status === "FAILED" || status === "EXPIRED";
  return (
    <ol className="timeline">
      {lifecycle
        .filter((item) => !["FAILED", "EXPIRED"].includes(item))
        .map((item, index) => (
          <li
            key={item}
            className={
              index < current
                ? "done"
                : index === current && !terminalFailure
                  ? "current"
                  : ""
            }
          >
            <span className="timeline-dot" />
            <span>{item.replaceAll("_", " ").toLowerCase()}</span>
          </li>
        ))}
      {terminalFailure && (
        <li className="current error">
          <span className="timeline-dot" />
          <span>{status.toLowerCase()}</span>
        </li>
      )}
    </ol>
  );
}
