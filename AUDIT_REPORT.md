# Backend Technical Audit Report — cynbit.in

**Prepared by:** Kanav Jain | Delhi Technological University  
**Role Applied:** Backend Developer Intern  
**Date of Observation:** October 30, 2026  
**Scope:** Passive, non-intrusive, publicly observable technical assessment

---

## 1. Executive Summary

This report documents an evidence-based backend technical audit of Cynbit Technologies' publicly accessible web presence at [cynbit.in](https://cynbit.in). The assessment focuses on observable architectural patterns, candidate portal access mechanisms, identifier design, data handling hygiene, and backend resilience practices.

All findings are strictly categorized using an evidence classification model to ensure technical accuracy and avoid unfounded assumptions. No active penetration testing, fuzzing, rate probing, or credential misuse was performed.

---

## 2. Assessment Scope & Coverage Matrix

In accordance with responsible disclosure and passive assessment guidelines, testing was strictly confined to publicly visible structures. Below is the explicit coverage breakdown:

| Technical Area | Assessment Status | Public Evidence / Observation Basis |
|---|---|---|
| **Candidate Portal Access** | Observed (Passive) | Direct capability URL observed; token expiration & revocation policies unverified |
| **Application Data Collection** | Publicly Observable | Extensive form fields inspectable on public careers page |
| **Identifier Structure** | Observed (Passive) | 25-character `c`-prefixed format characteristic of CUID v1 observed in URL routing |
| **Third-Party Email Delivery** | Documented (Public) | Resend explicitly designated in published Privacy Policy |
| **API Request / Response Behavior** | Not Independently Assessed | Internal API endpoints were not intercepted or probed |
| **Authentication & Session Mgmt** | Partially Observable | Capability URL observed; internal session architecture unverified |
| **Database Queries & Indexing** | Not Observable | Underlying query execution is private to server infrastructure |
| **Error Handling & Stack Traces** | Not Observable | No fault injection or abnormal requests generated |
| **Performance & Concurrency** | Not Assessed | No load testing or concurrency stress performed |
| **HTTP Security Headers** | Proactive Recommendation | Not verifiable via passive search; defensive baseline supplied |

### Evidence Classification System

- ✅ **VERIFIED**: Directly observable from public pages, URLs, or published legal documentation.
- 🔶 **INFERRED**: Reasoned deduction based on verified evidence, with explicit bounds noted.
- 💡 **RECOMMENDED**: Architectural best-practice guidance, independent of confirmed deficits.

---

## 3. Confirmed & Inferred Technology Stack

| Component | Status | Evidence Source |
|---|---|---|
| **Next.js** | ✅ VERIFIED | Static route chunks and asset routes (`/_next/`) on cynbit.in |
| **Prisma** | ✅ VERIFIED | Explicitly named in Cynbit's published Privacy Policy |
| **Resend** | ✅ VERIFIED | Explicitly named in Cynbit's published Privacy Policy |
| **TypeScript / Node.js** | 🔶 INFERRED | Standard runtime environment for Next.js and Prisma ecosystems |

> *Note: Technologies listed in Cynbit careers listings (e.g., PostgreSQL, MongoDB, Go, Python, OAuth, JWT) reflect role qualifications and tech competencies, not necessarily the current production architecture of the candidate portal.*

---

## 4. Technical Findings & Architectural Review

---

### Finding 1 — Candidate Capability URL Access Model & Token Security

**Severity:** Medium  
**Classification:** ✅ VERIFIED (access pattern) + 🔶 UNVERIFIED (expiry & revocation controls)

#### Observable Evidence
The candidate status portal is reachable via a direct capability URL pattern:

```text
https://www.cynbit.in/candidate/[REDACTED_CANDIDATE_ID]
```

Navigating to this URL renders candidate status information (name, email address, educational institution, city, and application progress) without a preliminary authentication challenge.

#### Architectural Analysis
A **capability URL** (or "bearer link") grants access simply by possession of the URI. While common for onboarding and transactional workflows (e.g., magic links, file shares), its security posture depends entirely on secondary controls:

1. **Expiry & Invalidation (Unverified):** Passive observation cannot determine whether the link expires after a set window (e.g., 7 days) or revokes upon candidate stage progression. If indefinite, the URL remains a persistent bearer credential in browser histories, proxy caches, and shared references.
2. **Token Format in Query Strings:** Passing persistent identifiers in the URI path or query string exposes them to `Referer` header leakage, web server access logs, and intermediate proxy logging.
3. **Cryptographic Opacity:** If the URL path parameter corresponds directly to an internal record key, knowledge of the ID format aids identifier enumeration.

#### Architectural Recommendation (Opaque Token Exchange)
Transition from a static URL parameter to a **cryptographically opaque token exchange**:
- Issue a high-entropy, random bearer token (32 bytes via `crypto.randomBytes`) sent via email.
- Store only the **SHA-256 hash** of the token in the database alongside a strict `expiresAt` timestamp and `revokedAt` flag.
- Upon first click, validate the token hash and immediately exchange it for a short-lived **`HttpOnly`, `SameSite=Lax`, `Secure` session cookie** (configured with `Path=/` in compliance with RFC 6265bis `__Host-` prefix requirements).
- Immediately redirect (HTTP 302) to a clean path (e.g. `/candidate/dashboard`) to strip the token parameter from the browser URL bar and history.
- Serve the exchange endpoint with `Referrer-Policy: no-referrer` and `Cache-Control: no-store` to prevent bearer token leakage via external referrers.

**Reference Implementation:** [`improvements/02-capability-url-auth.js`](./improvements/02-capability-url-auth.js)

---

### Finding 2 — Public Identifier Formatting & Information Entropy

**Severity:** Low  
**Classification:** ✅ VERIFIED (observable syntax) + 🔶 INFERRED (underlying generator)

#### Observable Evidence
Identifiers associated with the candidate experience exhibit a uniform structural pattern:
- **Length:** 25 characters
- **Character Set:** Lowercase alphanumeric base-36
- **Prefix:** Fixed lowercase `c`
- **Schematic Representation:** `c[timestamp:8][counter:4][fingerprint:4][random:8]`

#### Structural Analysis
This format strongly resembles **CUID v1**, which was historically the default identifier strategy in Prisma (`@default(cuid())`).

A standard CUID v1 identifier encodes internal generation metadata:
```text
c  [8-char time]  [4-char counter]  [4-char fingerprint]  [8-char random]
│   └──────────┘   └─────────────┘   └──────────────────┘  └─────────────┘
│    Timestamp        Counter              Host Client         Pseudo-Random
└── Fixed Prefix    (same-millisecond)     Fingerprint
```

#### Realistic Risk Evaluation
It is inaccurate to claim this exposes critical infrastructure or guarantees sequential enumeration. However, from a zero-trust architecture perspective:
- Identifiers with embedded temporal metadata allow statistical deduction of record generation windows over multi-sample collections.
- Modern backend design favors **fully opaque identifiers** with uniform entropy across all bytes.

#### Architectural Recommendation
If Prisma ORM is generating these keys, adopt **CUID v2** (`@default(cuid(2))`). CUID v2 mixes multiple entropy sources (system time, random entropy, session counters, host fingerprint) and feeds them through a SHA3-512 hashing pipeline, producing completely opaque identifiers with no decodable timing components.

```prisma
model Candidate {
  // Before: CUID v1 (contains timestamp & counter segments)
  // id String @id @default(cuid())

  // Recommended: CUID v2 (cryptographically opaque)
  id String @id @default(cuid(2))
}
```

> **Backend Engineering Note:** Updating `@default(cuid(2))` applies exclusively to newly inserted records; it does not automatically migrate or rewrite existing database primary keys. Furthermore, opaque identifiers do not replace server-side authorization and object-level access controls.

**Reference Implementation:** [`improvements/01-cuid-v2-migration.js`](./improvements/01-cuid-v2-migration.js)

---

### Finding 3 — Candidate PII Scope & Data Minimization Hygiene

**Severity:** Medium  
**Classification:** ✅ VERIFIED (collected fields) + 💡 RECOMMENDED (retention policy)

#### Observable Evidence
The application form at `/careers/backend-developer-intern` requests:
- **Personal:** Full Name, Email, Phone Number, WhatsApp Number, Date of Birth, Gender
- **Academic:** Qualification, Specialization, Institution, Graduation Year, Score (CGPA / %)
- **Location:** Current City, Permanent Address
- **Professional:** Portfolio URL, LinkedIn URL, GitHub / Behance, Notice Period, Skills

#### Architectural & Privacy Considerations
Under modern data protection frameworks (such as India's Digital Personal Data Protection Act, 2023, and GDPR Art. 5(1)(c)), systems handling personal data should practice **data minimization**:
- **Staged Ingestion:** Attributes such as permanent residential address, WhatsApp contact, and exact date of birth are administrative onboarding details rather than technical screening criteria. Collecting them prior to initial evaluation broadens the data liability surface.
- **Retention Lifecycle:** Storing comprehensive PII requires an automated data lifecycle strategy to prevent orphaned data accumulation.

#### Architectural Recommendation
1. **Phased Form Intake:** Defer sensitive demographic and physical location fields to the formal offer/onboarding stage.
2. **Automated Anonymization Lifecycle:** Deploy a scheduled background job to purge or anonymize candidate records that have concluded their evaluation cycle.

**Reference Implementation:** [`improvements/03-pii-minimization.md`](./improvements/03-pii-minimization.md)

---

### Finding 4 — Third-Party Transactional Email Delivery Architecture

**Severity:** Low  
**Classification:** ✅ VERIFIED (Resend integration) + 💡 RECOMMENDED (contractual & payload hygiene)

#### Observable Evidence
Cynbit's published Privacy Policy explicitly discloses **Resend** as its service provider for transactional email delivery.

#### Architectural & Regulatory Considerations
Resend operates as a third-party data processor. When dispatching candidate emails:
- Candidate email addresses and dynamic template variables pass through external mail infrastructure.
- In accordance with standard data privacy regulations (e.g., GDPR Art. 28), data controllers must ensure an active Data Processing Agreement (DPA) governs processing operations.
- Resend’s standard DPA takes effect upon acceptance of their applicable Terms of Service or execution of the addendum. Cynbit should verify the accepted agreement, effective date, and internal documentation confirming active coverage.

#### Architectural Recommendation
- **Sub-Processor Transparency:** Formally catalogue Resend in public privacy notices with a direct link to their DPA and privacy documentation.
- **Payload Scoping:** Ensure internal mail dispatch handlers strictly limit template payloads to operational essentials (e.g., first name, destination URL, role title) rather than serializing comprehensive candidate database records into template variables.

**Reference Implementation:** [`improvements/04-resend-dpa-handling.md`](./improvements/04-resend-dpa-handling.md)

---

### Finding 5 — HTTP Security Header Baseline (Proactive Guidance)

**Severity:** Informational  
**Classification:** 💡 RECOMMENDED (defensive baseline)

#### Context & Scope
Live HTTP response headers for cynbit.in were not independently verified during this passive audit. This finding is therefore presented purely as a **proactive implementation guideline** for Next.js architectures.

By default, Next.js does not enforce strict HTTP security headers without explicit declarations in `next.config.js`.

#### Recommended Baseline Configuration
A hardened header profile should be integrated into `next.config.js`:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

> **Implementation Caveats:** HSTS declarations utilizing `includeSubDomains; preload` require exhaustive validation of all domain routing to prevent breaking non-HTTPS subdomains. Similarly, `Permissions-Policy` definitions must align with future platform features (such as video interviewing).

**Reference Implementation:** [`improvements/05-security-headers.md`](./improvements/05-security-headers.md)

---

## 5. Recommended Backend Validation & Resilience Checks (Unverified Scope)

To address key backend engineering dimensions that were explicitly excluded from passive observation, the following defensive engineering practices are recommended for the candidate and ATS backend:

### A. Strict Schema Validation on Public Ingestion Endpoints
- **Recommendation:** Enforce strict runtime schema validation on candidate submission payloads. Reject unknown fields using strict schema validation (e.g., `z.object(...).strict()` in Zod) to prevent unexpected parameter injection or payload pollution.

### B. Standardized API Error Boundaries
- **Recommendation:** Implement a centralized API error wrapper. Raw database/Prisma exceptions (which disclose table names, unique constraint names, and query fragments) must never reach HTTP 500 JSON responses.

### C. Safe File Upload Architecture (Resumes & Portfolios)
- **Recommendation:** Rather than accepting file streams directly on application servers:
  1. Generate pre-signed POST uploads (AWS S3 or Cloudflare R2) backed by policy conditions enforcing strict file size boundaries (e.g., `['content-length-range', 1, 5242880]` for a 5MB ceiling) and authorized MIME types (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
  2. Perform server-side magic-byte inspection prior to indexing files.

### D. Layered Rate Limiting & Abuse Prevention
- **Recommendation:** Protect public submission forms and token exchange routes using edge-compatible distributed rate limiting (e.g., Upstash Redis token bucket). Prevent brute-force token enumeration and automated spam submissions.

### E. Database Query Performance & Indexing Strategy
- **Recommendation:** In candidate application tables, verify that composite indexes exist for common administrative filtering queries (e.g., `@@index([roleId, status, createdAt])`) to prevent sequential table scans as the applicant database scales.

### F. Asynchronous Job Queues for External APIs
- **Recommendation:** Decouple transactional email dispatches (Resend) and external webhook notifications from the synchronous HTTP request-response cycle using background queues (e.g., Redis + BullMQ). This prevents third-party latency from degrading candidate submission response times.

---

## 6. Summary Matrix & Actionable Roadmap

| # | Focus Area | Proposed Architectural Remedy | Implementation Complexity | Priority |
|---|---|---|---|---|
| **1** | Capability URL Auth | High-entropy opaque token + hash lookup + HttpOnly cookie | Moderate | High |
| **2** | Identifier Formatting | Migrate Prisma schema from `cuid()` to `cuid(2)` | Low (Schema update) | Medium |
| **3** | Data Minimization | Staged intake + scheduled anonymization worker | Moderate | Medium |
| **4** | Sub-processor Hygiene | Payload scoping + verified DPA record keeping | Low | Low |
| **5** | Security Headers | Custom `next.config.js` headers baseline | Low | Low |
| **6** | Ingestion & Async Queues | Zod validation + background queue for email dispatches | Moderate | Medium |

---

## 7. Conclusion

Cynbit's publicly visible technical footprint indicates a modern, thoughtfully selected tech stack centered on Next.js, Prisma, and Resend. The observations compiled in this audit represent standard engineering opportunities common to fast-iterating product teams. Implementing opaque tokenized sessions, CUID v2 identifiers, staged data intake, and asynchronous worker patterns will significantly elevate the platform's security, privacy, and architectural resilience.
