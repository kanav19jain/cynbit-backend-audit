/**
 * Finding 1 — Capability URL Hardening: Opaque Token Exchange & Session Lifecycle
 *
 * ARCHITECTURAL CONTEXT:
 * Accessing the candidate portal currently relies on a direct capability URI:
 *   https://cynbit.in/candidate/[REDACTED_CANDIDATE_ID]
 *
 * SECURITY RISKS OF RAW BEARER TOKENS IN URLS:
 * 1. Persistent tokens in URL paths/queries get stored in browser histories, proxy caches,
 *    and HTTP server access logs.
 * 2. If a user clicks an external link on the portal page, the URL (including query parameters)
 *    can be forwarded to external servers via the 'Referer' header unless explicitly restricted.
 * 3. Putting internal DB keys or JWTs directly into the URL allows any bearer to view or decode them.
 *
 * RECOMMENDED ARCHITECTURE (Opaque Token Exchange Pattern):
 * 1. Issue an opaque, high-entropy 32-byte token (256 bits) dispatched via transactional email.
 * 2. Store only the SHA-256 hash of the token in the database alongside 'expiresAt' and 'revokedAt'.
 *    Never store plaintext access tokens in database tables.
 * 3. When the candidate visits the link:
 *    - Compute the SHA-256 hash of the received token and lookup the database record.
 *    - Verify expiration and revocation state.
 * 4. Token Exchange & Clean Redirect:
 *    - Exchange the single-use token for a short-lived session cookie.
 *    - RFC 6265bis Compliance Note: Cookies utilizing the '__Host-' security prefix MUST
 *      have 'Path=/', must have 'Secure', and must omit the 'Domain' attribute. Supporting
 *      browsers will reject any '__Host-' cookie configured with a sub-path.
 *    - Respond with HTTP 302 redirecting to a clean path (e.g., /candidate/dashboard) so the token
 *      disappears from the user's browser address bar and history immediately.
 *    - Set 'Referrer-Policy: no-referrer' and 'Cache-Control: no-store' on the exchange endpoint.
 *
 * NOTE: The in-memory map and session token below are illustrative demonstration mocks.
 * In a full production deployment, session IDs are cryptographically generated and backed
 * by an encrypted database session store or distributed Redis cache.
 *
 * HOW TO RUN:
 *   npm install
 *   npm run demo:auth
 */

const crypto = require("crypto");

// ─────────────────────────────────────────────
//  SECTION 1: In-Memory Database Model (Simulation)
// ─────────────────────────────────────────────

// Simulates 'CandidatePortalToken' and 'CandidateSession' tables in Prisma/PostgreSQL
const simulatedDb = {
  // Key: tokenHash (SHA-256 hex) -> Value: { candidateId, expiresAt, revokedAt }
  tokens: new Map(),
  // Key: sessionToken (hex) -> Value: { candidateId, createdAt }
  sessions: new Map(),
};

// ─────────────────────────────────────────────
//  SECTION 2: Core Token Lifecycle Functions
// ─────────────────────────────────────────────

/**
 * Generates an opaque, one-time capability URL for a candidate.
 * Executed server-side before dispatching an invitation email.
 */
function issueCandidatePortalLink(candidateId, validHours = 72) {
  // 1. Generate 32 bytes of cryptographically secure random entropy
  const rawToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash token using SHA-256 for persistent database storage
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000);

  // 3. Persist hash with reference metadata (rawToken is NEVER stored)
  simulatedDb.tokens.set(tokenHash, {
    candidateId,
    expiresAt,
    revokedAt: null,
  });

  return {
    rawToken,
    portalUrl: `https://cynbit.in/candidate/verify?token=${rawToken}`,
    expiresAt,
  };
}

/**
 * Handles the incoming request when the applicant opens the email link.
 * Validates the token, revokes it (single-use), and issues a session cookie.
 */
function exchangeTokenForSession(rawToken) {
  if (!rawToken || typeof rawToken !== "string") {
    return {
      success: false,
      statusCode: 400,
      error: "Bad Request: Missing or invalid token parameter.",
    };
  }

  // 1. Hash incoming token to query against database records
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const record = simulatedDb.tokens.get(tokenHash);

  // 2. Cryptographic and business validation checks
  if (!record) {
    return {
      success: false,
      statusCode: 401,
      error: "Unauthorized: Invalid portal token.",
    };
  }

  if (record.revokedAt !== null) {
    return {
      success: false,
      statusCode: 401,
      error: "Unauthorized: Portal token has already been consumed or revoked.",
    };
  }

  if (new Date() > record.expiresAt) {
    return {
      success: false,
      statusCode: 401,
      error: "Unauthorized: Portal token has expired.",
    };
  }

  // 3. Consume token (single-use exchange pattern)
  record.revokedAt = new Date();

  // 4. Generate & persist session token to database sessions table
  const sessionToken = crypto.randomBytes(24).toString("hex");
  simulatedDb.sessions.set(sessionToken, {
    candidateId: record.candidateId,
    createdAt: new Date(),
  });

  // 5. Return RFC 6265bis-compliant cookie (__Host- prefix requires Path=/, Secure, and no Domain)
  return {
    success: true,
    statusCode: 302,
    redirectTo: "/candidate/dashboard", // Clean URL without token in query string
    candidateId: record.candidateId,
    headers: {
      "Set-Cookie": `__Host-Candidate-Session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Referrer-Policy": "no-referrer", // Strict: Prevents token leakage if external assets load
    },
  };
}

// ─────────────────────────────────────────────
//  SECTION 3: Demonstration Execution
// ─────────────────────────────────────────────

console.log("=== OPAQUE CAPABILITY TOKEN & SESSION EXCHANGE DEMO ===\n");

const internalCandidateId = "cand_app_98213";
console.log(`[Step 1] Server generates access link for internal candidate ID: ${internalCandidateId}`);
const { rawToken, portalUrl, expiresAt } = issueCandidatePortalLink(internalCandidateId, 48);

console.log(`  Dispatched URL:   ${portalUrl}`);
console.log(`  Expiration:       ${expiresAt.toISOString()}`);
console.log(`  Raw DB ID Hidden: Internal ID '${internalCandidateId}' never appears in the link.\n`);

console.log("[Step 2] Candidate opens link -> Server validates & exchanges token...");
const exchangeResponse = exchangeTokenForSession(rawToken);

console.log("  Exchange Status:  SUCCESS");
console.log(`  HTTP Response:    ${exchangeResponse.statusCode} Found (Redirect -> ${exchangeResponse.redirectTo})`);
console.log(`  Resolved Record:  ${exchangeResponse.candidateId}`);
console.log("  Security Headers:");
console.log(`    Set-Cookie:      ${exchangeResponse.headers["Set-Cookie"]}`);
console.log(`    Referrer-Policy: ${exchangeResponse.headers["Referrer-Policy"]}`);
console.log(`    Cache-Control:   ${exchangeResponse.headers["Cache-Control"]}\n`);

console.log("[Step 3] Replay Attack / Double Consumption Test (Single-Use Validation)...");
const replayResponse = exchangeTokenForSession(rawToken);
console.log(`  HTTP Status:      ${replayResponse.statusCode}`);
console.log(`  Error Output:     ${replayResponse.error}\n`);

console.log("[Step 4] Probing with Tampered / Malicious Token...");
const tamperedToken = "deadbeef" + rawToken.slice(8);
const tamperedResponse = exchangeTokenForSession(tamperedToken);
console.log(`  HTTP Status:      ${tamperedResponse.statusCode}`);
console.log(`  Error Output:     ${tamperedResponse.error}`);
