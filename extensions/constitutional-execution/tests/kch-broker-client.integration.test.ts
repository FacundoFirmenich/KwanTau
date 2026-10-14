import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "../src/canonical-json.js";
import { StdioKchAuthorityBroker } from "../src/kch-broker-client.js";

const brokerCommand = process.env.KCH_AUTHORITY_BROKER_COMMAND;
const describeBroker = brokerCommand ? describe : describe.skip;

describeBroker("real KCH stdio authority broker", () => {
  it("binds the exact TypeScript payload hash to one KCH authorization", async () => {
    const root = await mkdtemp(join(tmpdir(), "kch-kwantau-cross-language-"));
    const databasePath = join(root, "kch_native_r21.sqlite");
    const database = new DatabaseSync(databasePath);
    database.exec(
      [
        "PRAGMA journal_mode=WAL;",
        "CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);",
        "CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at TEXT NOT NULL,event_name TEXT NOT NULL,session_id TEXT,turn_id TEXT,payload_sha256 TEXT NOT NULL,payload_json TEXT,previous_hash TEXT NOT NULL,event_hash TEXT NOT NULL);",
        "CREATE TABLE proposals(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,session_id TEXT NOT NULL,turn_id TEXT,tool_name TEXT NOT NULL,args_sha256 TEXT NOT NULL,resources_json TEXT NOT NULL,tool_input_json TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',impact TEXT NOT NULL DEFAULT '',recovery TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'DRAFT');",
        "CREATE TABLE authorizations(proposal_id TEXT PRIMARY KEY REFERENCES proposals(id),session_id TEXT NOT NULL,args_sha256 TEXT NOT NULL,authorized_at TEXT NOT NULL,consumed_at TEXT,consumed_tool_use_id TEXT);",
      ].join("\n"),
    );

    const now = new Date().toISOString();
    const payload = {
      message: "Return exactly READY.",
      sessionKey: "agent:test:main",
      deliver: false,
      modelRun: true,
    };
    const argsSha256 = sha256Hex(payload);
    database.prepare("INSERT INTO settings VALUES(?,?,?)").run("persist_exact_inputs", "true", now);
    database
      .prepare(
        "INSERT INTO proposals(" +
          "id,created_at,session_id,turn_id,tool_name,args_sha256,resources_json," +
          "tool_input_json,reason,impact,recovery,status" +
          ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        "proposal-cross-language",
        now,
        "agent:test:main",
        "turn-1",
        "openclaw.agent",
        argsSha256,
        "[]",
        canonicalJson(payload),
        "cross-language test",
        "bounded fixture",
        "discard fixture",
        "AUTHORIZED",
      );
    database
      .prepare(
        "INSERT INTO authorizations(proposal_id,session_id,args_sha256,authorized_at) " +
          "VALUES(?,?,?,?)",
      )
      .run("proposal-cross-language", "agent:test:main", argsSha256, now);

    const broker = new StdioKchAuthorityBroker(
      brokerCommand as string,
      databasePath,
      5_000,
    );
    const params = {
      envelopeHash: "a".repeat(64),
      leaseId: "lease-cross-language",
      reservationId: "reservation-cross-language",
      decisionId: "decision-cross-language",
      intentId: "intent-cross-language",
      policyHash: "b".repeat(64),
      epoch: 9,
      sessionId: "agent:test:main",
      toolName: "openclaw.agent",
      argsSha256,
      ttlSeconds: 5,
    };

    const shadow = await broker.verify(params);
    expect(shadow.active).toBe(true);
    expect(shadow.status).toBe("AUTHORIZED_AVAILABLE");

    const prepared = await broker.prepare(params);
    expect(prepared.active).toBe(true);
    expect(prepared.status).toBe("PREPARED");
    expect(prepared.claimId).toBeTruthy();

    const committed = await broker.commit({
      claimId: prepared.claimId as string,
      envelopeHash: params.envelopeHash,
      dispatchId: "idem-cross-language",
    });
    expect(committed.status).toBe("COMMITTED");

    const consumed = database
      .prepare(
        "SELECT consumed_at,consumed_tool_use_id FROM authorizations WHERE proposal_id=?",
      )
      .get("proposal-cross-language") as {
      consumed_at: string | null;
      consumed_tool_use_id: string | null;
    };
    expect(consumed.consumed_at).toBeTruthy();
    expect(consumed.consumed_tool_use_id).toBe("idem-cross-language");

    const acceptance = {
      runId: "run-cross-language",
      sessionKey: "agent:test:main",
      status: "in_flight",
    };
    const receiptHash = sha256Hex(acceptance);
    const receipted = await broker.receipt({
      claimId: prepared.claimId as string,
      envelopeHash: params.envelopeHash,
      runId: acceptance.runId,
      receiptHash,
    });
    expect(receipted.status).toBe("COMMITTED");

    const claimRow = database
      .prepare(
        "SELECT dispatch_id,run_id,receipt_hash,status FROM authority_claims WHERE claim_id=?",
      )
      .get(prepared.claimId) as {
      dispatch_id: string;
      run_id: string;
      receipt_hash: string;
      status: string;
    };
    expect(claimRow).toEqual({
      dispatch_id: "idem-cross-language",
      run_id: "run-cross-language",
      receipt_hash: receiptHash,
      status: "COMMITTED",
    });

    const eventNames = (
      database.prepare("SELECT event_name FROM events ORDER BY id").all() as Array<{
        event_name: string;
      }>
    ).map((row) => row.event_name);
    expect(eventNames).toEqual([
      "KWANTAU_AUTHORITY_PREPARED",
      "KWANTAU_AUTHORITY_COMMITTED",
      "KWANTAU_AUTHORITY_RECEIPTED",
    ]);
    database.close();
  });
});
