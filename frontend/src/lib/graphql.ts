const endpoint =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://127.0.0.1:4000/graphql";

export type ReviewRow = {
  id: string;
  owner: string;
  mode: number;
  status: number;
  createdBlock: number;
  updatedBlock: number;
  versionCount: number;
  publicShare: boolean;
  provenanceVerified: boolean;
  latestHash?: string;
  latestURI?: string;
  latestScore?: number;
  latestReason?: string;
};

export async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Indexer returned ${response.status}`);
  const payload = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message);
  if (!payload.data) throw new Error("Indexer returned no data");
  return payload.data;
}

export const reviewFields = `
  id owner mode status createdBlock updatedBlock versionCount publicShare
  provenanceVerified latestHash latestURI latestScore latestReason
`;
