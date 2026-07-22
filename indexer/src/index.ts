import { createServer } from "node:http";
import { config } from "./config.js";
import { makeClient, syncOnce } from "./chain.js";
import { openDatabase } from "./database.js";
import { createGraphQLServer } from "./graphql.js";

if (/^0x0{40}$/i.test(config.registryAddress)) {
  console.warn(
    "REGISTRY_ADDRESS is not configured. API will run, but chain sync is disabled.",
  );
}

const db = openDatabase(config.dbPath);
const client = makeClient(config.rpcUrl);
const yoga = createGraphQLServer(db);
const server = createServer(yoga);
let syncing = false;

async function poll() {
  if (syncing || /^0x0{40}$/i.test(config.registryAddress)) return;
  syncing = true;
  try {
    const head = await syncOnce({
      db,
      client,
      registryAddress: config.registryAddress,
      trackerAddress: config.trackerAddress,
      startBlock: config.startBlock,
      confirmations: config.confirmations,
      batchSize: config.batchSize,
    });
    console.log(`Indexed confirmed block ${head}`);
  } catch (error) {
    console.error("Indexer sync failed", error);
  } finally {
    syncing = false;
  }
}

server.listen(config.port, "127.0.0.1", () => {
  console.log(`CodeProof indexer: http://127.0.0.1:${config.port}/graphql`);
  void poll();
  setInterval(() => void poll(), config.pollMs).unref();
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
