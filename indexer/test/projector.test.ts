import assert from "node:assert/strict";
import test from "node:test";
import { checkpointIsCanonical } from "../src/chain.js";
import {
  clearProjection,
  getCheckpoint,
  openDatabase,
  setCheckpoint,
} from "../src/database.js";
import { projectEvent, type ProjectionEvent } from "../src/projector.js";

const base: Omit<ProjectionEvent, "eventName" | "args" | "logIndex"> = {
  blockNumber: 100n,
  blockHash: `0x${"a".repeat(64)}`,
  timestamp: 1_700_000_000n,
  transactionHash: `0x${"b".repeat(64)}`,
  transactionValue: 10n,
};

test("projects review lifecycle and ignores duplicate logs", () => {
  const db = openDatabase(":memory:");
  projectEvent(db, {
    ...base,
    logIndex: 0,
    eventName: "ReviewRequested",
    args: {
      id: 7n,
      version: 1,
      owner: "0xABC",
      mode: 0,
      sourceHash: `0x${"1".repeat(64)}`,
      sourceURI: "hf://source.sol",
      provenanceVerified: true,
    },
  });
  projectEvent(db, {
    ...base,
    logIndex: 0,
    eventName: "ReviewRequested",
    args: {},
  });
  projectEvent(db, {
    ...base,
    logIndex: 1,
    eventName: "ReviewCommitted",
    args: {
      id: 7n,
      version: 1,
      score: 91,
      reportHash: `0x${"2".repeat(64)}`,
      reportURI: "hf://report.json",
      issues: { critical: 0, high: 1, medium: 2, low: 3, gas: 4 },
    },
  });

  const review = db.prepare("SELECT * FROM reviews WHERE id = '7'").get() as {
    status: number;
    latest_score: number;
  };
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM reviews")
    .get() as { count: number };
  assert.equal(count.count, 1);
  assert.equal(review.status, 3);
  assert.equal(review.latest_score, 91);
  db.close();
});

test("stores checkpoint and detects a reorg", async () => {
  const db = openDatabase(":memory:");
  const hash = `0x${"c".repeat(64)}` as const;
  setCheckpoint(db, 42n, hash);
  assert.deepEqual(getCheckpoint(db), { blockNumber: 42n, blockHash: hash });

  const canonical = await checkpointIsCanonical(db, {
    getBlock: async () => ({ hash }),
  } as never);
  const reorged = await checkpointIsCanonical(db, {
    getBlock: async () => ({ hash: `0x${"d".repeat(64)}` }),
  } as never);
  assert.equal(canonical, true);
  assert.equal(reorged, false);
  db.close();
});

test("clearProjection leaves an empty rebuildable database", () => {
  const db = openDatabase(":memory:");
  projectEvent(db, {
    ...base,
    logIndex: 0,
    eventName: "ReviewRequested",
    args: {
      id: 1n,
      version: 1,
      owner: "0xabc",
      mode: 1,
      sourceHash: `0x${"1".repeat(64)}`,
      sourceURI: "hf://source",
      provenanceVerified: false,
    },
  });
  setCheckpoint(db, 100n, base.blockHash);
  clearProjection(db);
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM reviews")
    .get() as { count: number };
  assert.equal(count.count, 0);
  assert.equal(getCheckpoint(db), null);
  db.close();
});
