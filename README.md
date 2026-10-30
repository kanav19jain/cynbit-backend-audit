# Cynbit Backend Technical Audit & Architectural Review

**Candidate:** Kanav Jain | Delhi Technological University  
**Role Applied:** Backend Developer Intern  
**Date of Observation:** October 30, 2026  
**Scope:** Passive, non-intrusive, publicly observable technical assessment

---

## 📌 Executive Summary

This repository contains an evidence-based technical assessment of [cynbit.in](https://cynbit.in) from a backend engineering and data security perspective.

In accordance with responsible disclosure principles, **all observations are derived strictly from publicly available sources** (the published Privacy Policy, public application forms, observable URI patterns, and framework static assets). No active penetration testing, vulnerability scanning, automated fuzzing, or unauthorized authentication bypass was conducted.

---

## 🧭 Assessment Coverage & Scope Matrix

To maintain rigorous technical accuracy, all areas are catalogued by verifiable observation status:

| Assessment Area | Status | Key Observation / Public Evidence |
|---|---|---|
| **Candidate Portal Access** | Observed (Passive) | Direct capability URL observed; token expiration & revocation unverified |
| **Application Data Intake** | Publicly Observable | Extensive form intake fields visible on public careers page |
| **Identifier Formatting** | Observed (Passive) | 25-character `c`-prefixed format characteristic of CUID v1 observed |
| **Email Sub-Processor** | Documented (Public) | Resend explicitly named in Cynbit's published Privacy Policy |
| **API Request/Response Behavior**| Not Independently Assessed | No internal backend routes probed |
| **Internal Database Queries** | Not Observable | Internal query execution is private to server infrastructure |
| **HTTP Security Headers** | Proactive Recommendation | Not verified passively; defensive Next.js baseline supplied |

---

## 📁 Repository Structure

```text
cynbit-backend-audit/
├── README.md                      ← Overview, coverage matrix, and execution guide
├── AUDIT_REPORT.md                ← Comprehensive backend audit report
└── improvements/                  ← Code demonstrations and architectural guidelines
    ├── 01-cuid-v2-migration.js    ← Finding 2: CUID v1 analysis & CUID v2 Prisma migration
    ├── 02-capability-url-auth.js  ← Finding 1: Opaque token exchange & HttpOnly session pattern
    ├── 03-pii-minimization.md     ← Finding 3: Staged data intake & retention cleanup script
    ├── 04-resend-dpa-handling.md  ← Finding 4: Resend payload scoping & DPA transparency
    └── 05-security-headers.md     ← Finding 5: Next.js HTTP security headers baseline
```

---

## 🧪 Testing the Code Demonstrations

All demonstrations run locally on Node.js without requiring external database connections:

```bash
# Install minimal dependencies (@paralleldrive/cuid2)
npm install

# Run Finding 2 Demo: Structural analysis of CUID v1 vs modern CUID v2
npm run demo:cuid

# Run Finding 1 Demo: Opaque token generation, SHA-256 hashing, clean redirect & replay protection
npm run demo:auth
```

---

## 🔑 Key Findings & Recommendations Summary

1. **Capability URL Access Model (Finding 1):**  
   Observed that candidate status pages use direct capability links. Recommended an opaque bearer token exchange pattern: storing SHA-256 hashed tokens in the database, verifying expiration, and issuing an `HttpOnly`, `SameSite=Lax`, `Secure` session cookie with an immediate 302 redirect to clean URLs, preventing URL token leakage in browser histories and referrer logs.

2. **Identifier Design & Information Entropy (Finding 2):**  
   Candidate identifiers match CUID v1 format (25 chars, `c`-prefixed), which embeds millisecond timestamp and sequential counter metadata. Recommended upgrading to Prisma's `@default(cuid(2))` for uniform, cryptographically opaque entropy, noting that CUID2 complements rather than replaces authorization checks.

3. **PII Collection & Data Minimization Hygiene (Finding 3):**  
   Initial application intake requests demographic and location details (DOB, WhatsApp, permanent address) prior to technical screening. Outlined a phased collection strategy and provided a scheduled Prisma worker script for anonymizing inactive records.

4. **Third-Party Email Delivery Architecture (Finding 4):**  
   Resend is disclosed as the transactional mail provider. Emphasized strictly scoping email template payloads to avoid serializing complete candidate records into third-party cloud infrastructure.

5. **Next.js HTTP Security Baseline (Finding 5):**  
   Supplied a recommended `next.config.js` headers baseline covering HSTS, X-Frame-Options, MIME sniffing protection, and Permissions-Policy with specific operational deployment caveats.

6. **Defensive Validation & Resilience Guidance (Section 5 of Report):**  
   Outlined proactive architectural recommendations for unverified areas: runtime Zod request validation, centralized error handling, pre-signed S3 file uploads for resumes, Upstash Redis rate limiting, and BullMQ asynchronous queues for external email APIs.

---

> For detailed analysis and findings, read the full [**AUDIT_REPORT.md**](./AUDIT_REPORT.md).
