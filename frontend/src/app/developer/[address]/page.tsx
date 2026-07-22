"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ReviewTable } from "@/components/review-table";
import { Badge, Panel } from "@/components/ui";
import { graphql, reviewFields, type ReviewRow } from "@/lib/graphql";

export default function DeveloperPage() {
  const params = useParams<{ address: string }>();
  const { data, isError } = useQuery({
    queryKey: ["developer", params.address],
    queryFn: () =>
      graphql<{ developerHistory: ReviewRow[] }>(
        `query Developer($address: String!) {
          developerHistory(address: $address, limit: 100) { ${reviewFields} }
        }`,
        { address: params.address },
      ),
  });
  const reviews = data?.developerHistory ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Developer history</span>
          <h1>Review profile</h1>
          <p className="mono code-hash">{params.address}</p>
        </div>
        <Badge tone={isError ? "danger" : "success"}>
          {reviews.length} reviews
        </Badge>
      </div>
      <Panel>
        <ReviewTable reviews={reviews} />
      </Panel>
    </>
  );
}
