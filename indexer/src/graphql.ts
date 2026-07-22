import { createYoga, createSchema } from "graphql-yoga";
import type { CodeProofDatabase } from "./database.js";

const typeDefs = /* GraphQL */ `
  type IssueSummary {
    critical: Int!
    high: Int!
    medium: Int!
    low: Int!
    gas: Int!
  }

  type ReviewVersion {
    reviewId: ID!
    version: Int!
    mode: Int!
    status: Int!
    sourceHash: String!
    sourceURI: String!
    provenanceVerified: Boolean!
    score: Int
    reportHash: String
    reportURI: String
    issues: IssueSummary!
    jobId: String
    scheduleId: String
    reason: String
    createdBlock: Int!
    updatedBlock: Int!
  }

  type Review {
    id: ID!
    owner: String!
    mode: Int!
    status: Int!
    createdBlock: Int!
    updatedBlock: Int!
    versionCount: Int!
    publicShare: Boolean!
    provenanceVerified: Boolean!
    latestHash: String
    latestURI: String
    latestScore: Int
    latestReason: String
    versions: [ReviewVersion!]!
  }

  type Certificate {
    tokenId: ID!
    reviewId: ID!
    version: Int!
    owner: String!
    reportHash: String
    reportURI: String
    blockNumber: Int!
    txHash: String!
  }

  type IndexerStatus {
    blockNumber: Int
    blockHash: String
  }

  type Query {
    review(id: ID!): Review
    reviews(owner: String, publicOnly: Boolean = false, offset: Int = 0, limit: Int = 25): [Review!]!
    developerHistory(address: String!, offset: Int = 0, limit: Int = 25): [Review!]!
    certificates(owner: String, offset: Int = 0, limit: Int = 25): [Certificate!]!
    indexerStatus: IndexerStatus!
  }
`;

const reviewColumns = `
  id, owner, mode, status, created_block AS createdBlock,
  updated_block AS updatedBlock, version_count AS versionCount,
  public_share AS publicShare, provenance_verified AS provenanceVerified,
  latest_hash AS latestHash, latest_uri AS latestURI,
  latest_score AS latestScore, latest_reason AS latestReason
`;

const versionColumns = `
  review_id AS reviewId, version, mode, status, source_hash AS sourceHash,
  source_uri AS sourceURI, provenance_verified AS provenanceVerified,
  score, report_hash AS reportHash, report_uri AS reportURI,
  critical, high, medium, low, gas, job_id AS jobId,
  schedule_id AS scheduleId, reason, created_block AS createdBlock,
  updated_block AS updatedBlock
`;

function normalizeReview(row: Record<string, unknown>) {
  return {
    ...row,
    publicShare: Boolean(row.publicShare),
    provenanceVerified: Boolean(row.provenanceVerified),
  };
}

function normalizeVersion(row: Record<string, unknown>) {
  return {
    ...row,
    provenanceVerified: Boolean(row.provenanceVerified),
    issues: {
      critical: row.critical,
      high: row.high,
      medium: row.medium,
      low: row.low,
      gas: row.gas,
    },
  };
}

export function createGraphQLServer(db: CodeProofDatabase) {
  return createYoga({
    graphqlEndpoint: "/graphql",
    healthCheckEndpoint: "/health",
    schema: createSchema({
      typeDefs,
      resolvers: {
        Query: {
          review: (_root, { id }: { id: string }) => {
            const row = db
              .prepare(`SELECT ${reviewColumns} FROM reviews WHERE id = ?`)
              .get(id) as Record<string, unknown> | undefined;
            return row ? normalizeReview(row) : null;
          },
          reviews: (
            _root,
            args: {
              owner?: string;
              publicOnly?: boolean;
              offset?: number;
              limit?: number;
            },
          ) => {
            const where: string[] = [];
            const values: Array<string | number> = [];
            if (args.owner) {
              where.push("owner = ?");
              values.push(args.owner.toLowerCase());
            }
            if (args.publicOnly) where.push("public_share = 1");
            const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
            values.push(Math.min(args.limit ?? 25, 100), args.offset ?? 0);
            return (
              db
                .prepare(
                  `SELECT ${reviewColumns} FROM reviews ${clause} ORDER BY updated_block DESC LIMIT ? OFFSET ?`,
                )
                .all(...values) as Record<string, unknown>[]
            ).map(normalizeReview);
          },
          developerHistory: (
            _root,
            args: { address: string; offset?: number; limit?: number },
          ) =>
            (
              db
                .prepare(
                  `SELECT ${reviewColumns} FROM reviews WHERE owner = ? ORDER BY created_block DESC LIMIT ? OFFSET ?`,
                )
                .all(
                  args.address.toLowerCase(),
                  Math.min(args.limit ?? 25, 100),
                  args.offset ?? 0,
                ) as Record<string, unknown>[]
            ).map(normalizeReview),
          certificates: (
            _root,
            args: { owner?: string; offset?: number; limit?: number },
          ) => {
            const ownerClause = args.owner ? "WHERE owner = ?" : "";
            const values: Array<string | number> = args.owner
              ? [args.owner.toLowerCase()]
              : [];
            values.push(Math.min(args.limit ?? 25, 100), args.offset ?? 0);
            return db
              .prepare(`
                SELECT token_id AS tokenId, review_id AS reviewId, version, owner,
                  report_hash AS reportHash, report_uri AS reportURI,
                  block_number AS blockNumber, tx_hash AS txHash
                FROM certificates ${ownerClause}
                ORDER BY block_number DESC LIMIT ? OFFSET ?
              `)
              .all(...values);
          },
          indexerStatus: () =>
            db
              .prepare(
                "SELECT block_number AS blockNumber, block_hash AS blockHash FROM checkpoints WHERE name = 'chain'",
              )
              .get() ?? {},
        },
        Review: {
          versions: (review: { id: string }) =>
            (
              db
                .prepare(
                  `SELECT ${versionColumns} FROM versions WHERE review_id = ? ORDER BY version DESC`,
                )
                .all(review.id) as Record<string, unknown>[]
            ).map(normalizeVersion),
        },
      },
    }),
  });
}
