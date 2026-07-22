import type { CodeProofDatabase } from "./database.js";

export type ProjectionEvent = {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  blockHash: string;
  timestamp: bigint;
  transactionHash: string;
  transactionValue?: bigint;
  logIndex: number;
};

const text = (value: unknown) => String(value ?? "");
const num = (value: unknown) => Number(value ?? 0);
const bool = (value: unknown) => (value ? 1 : 0);

function isProcessed(db: CodeProofDatabase, event: ProjectionEvent): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM processed_logs WHERE tx_hash = ? AND log_index = ?")
      .get(event.transactionHash, event.logIndex),
  );
}

function markProcessed(db: CodeProofDatabase, event: ProjectionEvent): void {
  db.prepare(
    "INSERT INTO processed_logs(tx_hash, log_index, block_number) VALUES (?, ?, ?)",
  ).run(event.transactionHash, event.logIndex, Number(event.blockNumber));
}

export function projectEvent(
  db: CodeProofDatabase,
  event: ProjectionEvent,
): void {
  if (isProcessed(db, event)) return;
  const a = event.args;
  const block = Number(event.blockNumber);

  db.exec("BEGIN IMMEDIATE");
  try {
    switch (event.eventName) {
      case "ReviewRequested": {
        const id = text(a.id);
        const version = num(a.version);
        db.prepare(`
          INSERT INTO reviews(
            id, owner, mode, status, created_block, updated_block, version_count, provenance_verified
          ) VALUES (?, ?, ?, 0, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            mode = excluded.mode,
            status = 0,
            updated_block = excluded.updated_block,
            version_count = MAX(reviews.version_count, excluded.version_count),
            provenance_verified = excluded.provenance_verified
        `).run(
          id,
          text(a.owner).toLowerCase(),
          num(a.mode),
          block,
          block,
          version,
          bool(a.provenanceVerified),
        );
        db.prepare(`
          INSERT INTO versions(
            review_id, version, mode, status, source_hash, source_uri,
            provenance_verified, created_block, updated_block
          ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
          ON CONFLICT(review_id, version) DO NOTHING
        `).run(
          id,
          version,
          num(a.mode),
          text(a.sourceHash),
          text(a.sourceURI),
          bool(a.provenanceVerified),
          block,
          block,
        );
        if ((event.transactionValue ?? 0n) > 0n) {
          db.prepare(`
            INSERT OR IGNORE INTO payments(
              tx_hash, review_id, payer, amount, block_number, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            event.transactionHash,
            id,
            text(a.owner).toLowerCase(),
            text(event.transactionValue),
            block,
            Number(event.timestamp),
          );
        }
        break;
      }
      case "ReviewStatusUpdated":
        db.prepare(
          "UPDATE reviews SET status = ?, updated_block = ?, latest_reason = ? WHERE id = ?",
        ).run(num(a.status), block, text(a.reason), text(a.id));
        db.prepare(
          "UPDATE versions SET status = ?, reason = ?, updated_block = ? WHERE review_id = ? AND version = ?",
        ).run(num(a.status), text(a.reason), block, text(a.id), num(a.version));
        break;
      case "SourceFetched":
        db.prepare(
          "UPDATE reviews SET status = 1, updated_block = ? WHERE id = ?",
        ).run(block, text(a.id));
        db.prepare(
          "UPDATE versions SET status = 1, source_hash = ?, updated_block = ? WHERE review_id = ? AND version = ?",
        ).run(text(a.sourceHash), block, text(a.id), num(a.version));
        break;
      case "LLMReviewScheduled":
        db.prepare(
          "UPDATE reviews SET status = 2, updated_block = ? WHERE id = ?",
        ).run(block, text(a.id));
        db.prepare(
          "UPDATE versions SET status = 2, schedule_id = ?, updated_block = ? WHERE review_id = ? AND version = ?",
        ).run(text(a.scheduleId), block, text(a.id), num(a.version));
        break;
      case "DeepReviewSubmitted":
        db.prepare(
          "UPDATE reviews SET status = 2, updated_block = ? WHERE id = ?",
        ).run(block, text(a.id));
        db.prepare(
          "UPDATE versions SET status = 2, job_id = ?, updated_block = ? WHERE review_id = ? AND version = ?",
        ).run(text(a.jobId), block, text(a.id), num(a.version));
        break;
      case "ReviewCommitted": {
        const issues = (a.issues ?? {}) as Record<string, unknown>;
        db.prepare(`
          UPDATE versions SET status = 3, score = ?, report_hash = ?, report_uri = ?,
            critical = ?, high = ?, medium = ?, low = ?, gas = ?, updated_block = ?
          WHERE review_id = ? AND version = ?
        `).run(
          num(a.score),
          text(a.reportHash),
          text(a.reportURI),
          num(issues.critical ?? (a.issues as readonly unknown[])?.[0]),
          num(issues.high ?? (a.issues as readonly unknown[])?.[1]),
          num(issues.medium ?? (a.issues as readonly unknown[])?.[2]),
          num(issues.low ?? (a.issues as readonly unknown[])?.[3]),
          num(issues.gas ?? (a.issues as readonly unknown[])?.[4]),
          block,
          text(a.id),
          num(a.version),
        );
        db.prepare(`
          UPDATE reviews SET status = 3, updated_block = ?, latest_hash = ?,
            latest_uri = ?, latest_score = ? WHERE id = ?
        `).run(
          block,
          text(a.reportHash),
          text(a.reportURI),
          num(a.score),
          text(a.id),
        );
        break;
      }
      case "ReviewVisibilityUpdated":
        db.prepare(
          "UPDATE reviews SET public_share = ?, updated_block = ? WHERE id = ?",
        ).run(bool(a.publicShare), block, text(a.id));
        break;
      case "CertificateMinted": {
        const review = db
          .prepare(
            "SELECT owner, latest_hash, latest_uri FROM reviews WHERE id = ?",
          )
          .get(text(a.reviewId)) as
          | { owner: string; latest_hash: string | null; latest_uri: string | null }
          | undefined;
        db.prepare(`
          INSERT OR REPLACE INTO certificates(
            token_id, review_id, version, owner, report_hash, report_uri, block_number, tx_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          text(a.tokenId),
          text(a.reviewId),
          num(a.version),
          review?.owner ?? "",
          review?.latest_hash ?? null,
          review?.latest_uri ?? null,
          block,
          event.transactionHash,
        );
        break;
      }
      case "JobAdded":
        db.prepare(`
          INSERT OR REPLACE INTO async_jobs(
            job_id, executor, precompile_address, sender_address, status,
            commit_block, ttl, created_at, updated_block
          ) VALUES (?, ?, ?, ?, 'COMMITTED', ?, ?, ?, ?)
        `).run(
          text(a.jobId),
          text(a.executor).toLowerCase(),
          text(a.precompileAddress).toLowerCase(),
          text(a.senderAddress).toLowerCase(),
          num(a.commitBlock),
          num(a.ttl),
          num(a.createdAt),
          block,
        );
        break;
      case "Phase1Settled":
        db.prepare(
          "UPDATE async_jobs SET status = 'RESULT_READY', settled_block = ?, updated_block = ? WHERE job_id = ?",
        ).run(num(a.settledBlock), block, text(a.jobId));
        break;
      case "ResultDelivered":
        db.prepare(
          "UPDATE async_jobs SET status = ?, target = ?, success = ?, updated_block = ? WHERE job_id = ?",
        ).run(
          a.success ? "SETTLED" : "FAILED",
          text(a.target).toLowerCase(),
          bool(a.success),
          block,
          text(a.jobId),
        );
        break;
      case "JobRemoved":
        db.prepare(
          "UPDATE async_jobs SET status = ?, success = ?, updated_block = ? WHERE job_id = ?",
        ).run(
          a.completed ? "SETTLED" : "FAILED",
          bool(a.completed),
          block,
          text(a.jobId),
        );
        break;
    }
    db.prepare(
      "INSERT OR REPLACE INTO blocks(number, hash, timestamp) VALUES (?, ?, ?)",
    ).run(block, event.blockHash, Number(event.timestamp));
    markProcessed(db, event);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
