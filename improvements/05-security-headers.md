# Finding 5 — HTTP Security Header Baseline for Next.js

> **Classification:** 💡 RECOMMENDED  
> This documentation provides proactive guidance for hardening Next.js application headers.
> Live HTTP response headers were not independently audited; this configuration represents a defense-in-depth baseline.

---

## Architectural Context

Next.js provides high performance out of the box, but default deployments do not automatically enforce strict HTTP security headers. These headers must be declared explicitly in `next.config.js` via the `headers()` asynchronous configuration block.

---

## Recommended `next.config.js` Implementation

```javascript
/** @type {import('next').NextConfig} */

const securityHeaders = [
  {
    // Enforce HTTPS communication
    // Note: 'includeSubDomains' and 'preload' should only be enabled after verifying
    // that all corporate subdomains support HTTPS.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Prevent browsers from MIME-sniffing responses away from declared Content-Type
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Protect against clickjacking by disallowing cross-origin iframe embedding
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Transmit full URL referrer across same-origin, but only domain on cross-origin HTTPS
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict access to sensitive browser device APIs
    // Adjust permissions if application features require media inputs (e.g., video interviewing)
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## Technical Rationale & Deployment Considerations

| Header | Primary Security Value | Deployment Caveats |
|---|---|---|
| `Strict-Transport-Security` | Eliminates SSL-stripping and forced HTTP downgrade attacks | Test without `preload` first; ensure all active subdomains serve valid TLS certificates |
| `X-Content-Type-Options` | Blocks executable script execution masquerading as images/text | Standard safe default across all modern web runtimes |
| `X-Frame-Options` | Shields sensitive candidate portal forms from clickjacking framing | Safe default unless third-party iframe embedding is an intentional product feature |
| `Referrer-Policy` | Prevents sensitive query parameters and URL tokens from leaking to external referrers | Balanced baseline for privacy and analytical attribution |
| `Permissions-Policy` | Restricts hardware APIs from execution in compromised contexts | Verify that platform features (such as webcam capture for assessments) are unblocked |

---

## Content Security Policy (CSP) Strategy

A strict Content Security Policy (CSP) provides the highest degree of defense against Cross-Site Scripting (XSS). However, deploying a rigid CSP without continuous telemetry can unintentionally block third-party analytics, fonts, or CDNs.

**Recommendation:** Deploy CSP initially using the `Content-Security-Policy-Report-Only` header to aggregate violation telemetry via an endpoint before switching to active enforcement:

```javascript
{
  key: "Content-Security-Policy-Report-Only",
  value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; report-uri /api/csp-violations"
}
```
