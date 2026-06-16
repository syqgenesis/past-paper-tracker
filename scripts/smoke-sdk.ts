/**
 * Phase 0 smoke test — verify Claude Agent SDK works against the user's
 * subscription auth (not metered API), and cannot silently fall back to
 * ANTHROPIC_API_KEY even if one is set in the shell environment.
 *
 * Run: npx tsx scripts/smoke-sdk.ts
 * Expected: prints "OK" at the end and exits 0.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  // ── Guard 1: strip any stray ANTHROPIC_API_KEY ─────────────────────────────
  // The SDK will silently prefer ANTHROPIC_API_KEY over the Claude Code OAuth
  // session if one is set. Unset it and refuse to run if something puts it back.
  if (process.env.ANTHROPIC_API_KEY !== undefined) {
    console.warn(
      `[guard] unsetting ANTHROPIC_API_KEY (length=${process.env.ANTHROPIC_API_KEY.length}) before SDK call`
    );
    delete process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.ANTHROPIC_API_KEY !== undefined) {
    throw new Error("[guard] ANTHROPIC_API_KEY is still set after delete — refusing to call SDK");
  }

  // ── Smoke call ─────────────────────────────────────────────────────────────
  const start = Date.now();
  const q = query({
    prompt: 'Respond with exactly the JSON {"ok":true,"from":"claude"} and nothing else.',
    options: {
      model: "haiku",
      allowedTools: [], // no tools; pure text reply
    },
  });

  let assistantText = "";
  let apiKeySource: string | undefined;
  let messageCount = 0;

  for await (const msg of q) {
    messageCount++;
    if (msg.type === "system" && msg.subtype === "init") {
      // SDKSystemMessage has apiKeySource field — tells us how auth resolved
      apiKeySource = (msg as { apiKeySource?: string }).apiKeySource;
    }
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") assistantText += block.text;
      }
    }
    if (msg.type === "result") break;
  }

  const elapsed = Date.now() - start;

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log("──────────────────────────────────────────");
  console.log(`messages received: ${messageCount}`);
  console.log(`auth source:       ${apiKeySource ?? "(unknown)"}`);
  console.log(`elapsed:           ${elapsed}ms`);
  console.log(`assistant reply:   ${assistantText.trim()}`);
  console.log("──────────────────────────────────────────");

  // ── Guard 2: confirm subscription auth, not api-key auth ───────────────────
  // "oauth" or "none" means the SDK did NOT source an API key — it's using
  // the Claude Code subscription session. Any of "user" / "project" / "org"
  // / "temporary" means an API key was found — reject loudly.
  const SAFE_SOURCES = new Set(["oauth", "none", undefined]);
  if (!SAFE_SOURCES.has(apiKeySource)) {
    throw new Error(
      `[guard] apiKeySource=${apiKeySource} — SDK is using an API key, not your Claude Code subscription. Check for ANTHROPIC_API_KEY in dotfiles, .env files, or ~/.claude/settings.json.`
    );
  }

  if (!assistantText.includes("ok")) {
    throw new Error(`[guard] assistant did not return expected payload: ${assistantText}`);
  }

  console.log("OK");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
