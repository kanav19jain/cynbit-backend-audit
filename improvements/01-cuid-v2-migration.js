/**
 * Finding 2 — CUID v1 to CUID v2 Identifier Design & Entropy Review
 *
 * ARCHITECTURAL CONTEXT:
 * Candidate portal routing exhibits 25-character, 'c'-prefixed identifiers:
 *   /candidate/[REDACTED_CANDIDATE_ID]
 *
 * STRUCTURAL ANALYSIS (CUID v1):
 * This format reflects CUID v1 (historically default in Prisma via @default(cuid())):
 *   c  [8-char time]  [4-char counter]  [4-char fingerprint]  [8-char random]
 *
 * In CUID v1, the timestamp segment (base-36 encoded milliseconds) and counter are
 * directly readable without hashing. While not an immediate vulnerability, modern zero-trust
 * architectures favor cryptographically opaque identifiers where internal metadata cannot be inferred.
 *
 * CUID v2 RESOLUTION:
 * CUID2 combines multiple entropy sources (system time, cryptographically strong random values,
 * a process counter, and host fingerprint), but feeds them through a SHA3-512 hashing pipeline.
 * The resulting identifier is uniformly random and completely opaque: no timestamp, counter,
 * or host characteristics can be extracted from the string.
 *
 * IMPORTANT BACKEND CONSIDERATIONS:
 * 1. Schema Default: Updating Prisma to @default(cuid(2)) affects NEW records only.
 *    Existing database primary keys remain untouched unless an explicit migration script runs.
 * 2. Defense-in-Depth: Opaque identifiers improve defense against enumeration, but they
 *    do NOT replace authentication, authorization checks, or object-level access control (IDOR protection).
 *
 * HOW TO RUN:
 *   npm install
 *   npm run demo:cuid
 */

const { createId } = require("@paralleldrive/cuid2");

// ─────────────────────────────────────────────
//  SECTION 1: Schematic Structure of CUID v1
// ─────────────────────────────────────────────

console.log("── CUID v1: Schematic Structure Breakdown ──");
console.log("Format: c + [8-char timestamp] + [4-char counter] + [4-char fingerprint] + [8-char random]");
console.log("Example schematic: c jld2cyuq 0000 t3rm niod1foy (25 chars total)");
console.log("");
console.log("Characteristics:");
console.log("  • Starts with a fixed 'c' prefix.");
console.log("  • Embedded base-36 timestamp reflects creation millisecond.");
console.log("  • Counter increments for IDs generated within the same millisecond.");
console.log("  • Risk: Over large collections, timing and relative generation sequence can be observed.");

// ─────────────────────────────────────────────
//  SECTION 2: CUID v2 — Cryptographic Opacity
// ─────────────────────────────────────────────

const sampleCuid2 = createId();

console.log("\n── CUID v2: Modern Cryptographically Opaque Identifier ──");
console.log("Generated CUID v2:", sampleCuid2);
console.log("");
console.log("How CUID2 works:");
console.log("  • Mixes time, entropy, host fingerprint, and counters through SHA3-512.");
console.log("  • Hashes the input so internal generation metadata cannot be recovered.");
console.log("  • No fixed prefix (first character is randomized letter), preventing prefix filtering.");

// ─────────────────────────────────────────────
//  SECTION 3: Prisma Schema Implementation
// ─────────────────────────────────────────────

console.log(`
── Prisma Schema Migration ──

  // BEFORE (schema.prisma) — CUID v1:
  model Candidate {
    id String @id @default(cuid())
  }

  // RECOMMENDED (schema.prisma) — CUID v2:
  model Candidate {
    id String @id @default(cuid(2))
  }

Backend Engineering Notes:
  1. 'cuid(2)' is natively supported in Prisma ORM.
  2. Applies to newly inserted records; existing records retain their original primary keys.
  3. CUID2 must always be paired with server-side authorization checks (e.g. session validation).
`);

// ─────────────────────────────────────────────
//  SECTION 4: In-Memory Generation Demonstration
// ─────────────────────────────────────────────

console.log("── Generated CUID v2 Identifiers (Demonstration) ──");
for (let i = 1; i <= 3; i++) {
  console.log(`  [ID ${i}]: ${createId()}`);
}
