import { ExternalLink, FileSearch } from "lucide-react";
import Link from "next/link";
import type { ReviewRow } from "@/lib/graphql";
import { reviewStatuses, statusTone } from "@/lib/status";
import { Badge } from "./ui";

const short = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

export function ReviewTable({ reviews }: { reviews: ReviewRow[] }) {
  if (!reviews.length) {
    return (
      <div className="empty">
        <FileSearch size={28} />
        <div>No indexed reviews yet</div>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Review</th>
            <th>Developer</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Score</th>
            <th>Version</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id}>
              <td className="mono">#{review.id}</td>
              <td className="mono muted">{short(review.owner)}</td>
              <td>{review.mode === 0 ? "Fast" : "Deep"}</td>
              <td>
                <Badge tone={statusTone(review.status)}>
                  {reviewStatuses[review.status] ?? "Unknown"}
                </Badge>
              </td>
              <td className="mono">{review.latestScore ?? "--"}</td>
              <td>v{review.versionCount}</td>
              <td>
                <Link
                  href={`/result/${review.id}`}
                  aria-label={`Open review ${review.id}`}
                >
                  <ExternalLink size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
