import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type CodeProofDatabase = DatabaseSync;

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  mode INTEGER NOT NULL,
  status INTEGER NOT NULL,
  created_block INTEGER NOT NULL,
  updated_block INTEGER NOT NULL,
  version_count INTEGER NOT NULL,
  public_share INTEGER NOT NULL DEFAULT 0,
  provenance_verified INTEGER NOT NULL DEFAULT 0,
  latest_hash TEXT,
  latest_uri TEXT,
  latest_score INTEGER,
  latest_reason TEXT
);

CREATE INDEX IF NOT EXISTS reviews_owner_idx ON reviews(owner, created_block DESC);
CREATE INDEX IF NOT EXISTS reviews_public_idx ON reviews(public_share, updated_block DESC);

CREATE TABLE IF NOT EXISTS versions (
  review_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  mode INTEGER NOT NULL,
  status INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  provenance_verified INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  report_hash TEXT,
  report_uri TEXT,
  critical INTEGER NOT NULL DEFAULT 0,
  high INTEGER NOT NULL DEFAULT 0,
  medium INTEGER NOT NULL DEFAULT 0,
  low INTEGER NOT NULL DEFAULT 0,
  gas INTEGER NOT NULL DEFAULT 0,
  job_id TEXT,
  schedule_id TEXT,
  reason TEXT,
  created_block INTEGER NOT NULL,
  updated_block INTEGER NOT NULL,
  PRIMARY KEY (review_id, version)
);

CREATE TABLE IF NOT EXISTS certificates (
  token_id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  owner TEXT NOT NULL,
  report_hash TEXT,
  report_uri TEXT,
  block_number INTEGER NOT NULL,
  tx_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  tx_hash TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  payer TEXT NOT NULL,
  amount TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS async_jobs (
  job_id TEXT PRIMARY KEY,
  executor TEXT,
  precompile_address TEXT,
  sender_address TEXT,
  target TEXT,
  status TEXT NOT NULL,
  commit_block INTEGER,
  ttl INTEGER,
  created_at INTEGER,
  settled_block INTEGER,
  success INTEGER,
  updated_block INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_logs (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number INTEGER NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS blocks (
  number INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
  name TEXT PRIMARY KEY,
  block_number INTEGER NOT NULL,
  block_hash TEXT NOT NULL
);
`;

export function openDatabase(path: string): CodeProofDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(schema);
  return db;
}

export function clearProjection(db: CodeProofDatabase): void {
  db.exec(`
    DELETE FROM payments;
    DELETE FROM certificates;
    DELETE FROM async_jobs;
    DELETE FROM versions;
    DELETE FROM reviews;
    DELETE FROM processed_logs;
    DELETE FROM blocks;
    DELETE FROM checkpoints;
  `);
}

export function getCheckpoint(
  db: CodeProofDatabase,
): { blockNumber: bigint; blockHash: `0x${string}` } | null {
  const row = db
    .prepare(
      "SELECT block_number AS blockNumber, block_hash AS blockHash FROM checkpoints WHERE name = 'chain'",
    )
    .get() as { blockNumber: number; blockHash: `0x${string}` } | undefined;
  return row
    ? { blockNumber: BigInt(row.blockNumber), blockHash: row.blockHash }
    : null;
}

export function setCheckpoint(
  db: CodeProofDatabase,
  blockNumber: bigint,
  blockHash: string,
): void {
  db.prepare(`
    INSERT INTO checkpoints(name, block_number, block_hash)
    VALUES ('chain', ?, ?)
    ON CONFLICT(name) DO UPDATE SET block_number = excluded.block_number, block_hash = excluded.block_hash
  `).run(Number(blockNumber), blockHash);
}
