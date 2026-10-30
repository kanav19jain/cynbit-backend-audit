# Finding 4 — Third-Party Transactional Email Architecture (Resend)

> **Classification:** ✅ VERIFIED (Disclosed Service Provider) + 💡 RECOMMENDED (Architectural Guidance)

---

## 1. Context & Observable Evidence

Cynbit’s published Privacy Policy explicitly lists **Resend** as its service provider for transactional email delivery.

Utilizing a managed transactional email API (such as Resend, AWS SES, or Postmark) is a standard architectural choice for modern Next.js deployments. This review evaluates the contractual data governance and payload hygiene best practices associated with third-party mail integration.

---

## 2. Regulatory & Contractual Data Processing

When automated backend triggers dispatch candidate notifications:
- Recipient email addresses and injected dynamic variables are transmitted to Resend's edge infrastructure.
- Under data protection regulations (such as GDPR Article 28 and India's Digital Personal Data Protection Act, 2023), external vendors that process personal data on behalf of a controller act as **data processors**.

### Contractual Tracking
Resend's standard Data Processing Addendum (DPA) takes effect upon acceptance of their applicable Terms of Service or execution of the addendum. Organizations should verify the accepted agreement, effective date, and internal documentation confirming active coverage.

---

## 3. Architectural Recommendations

### A. Minimalist Email Payload Scoping

Application handlers should strictly isolate data dispatched to third-party email APIs. Avoid serializing entire candidate database objects into template variables; supply only the bare minimum fields necessary to render the notification.

```javascript
/**
 * Example: Scoped transactional email dispatch using Resend Node.js SDK
 *
 * NOTE: The template structure and parameters below are illustrative implementation
 * examples demonstrating payload minimization, not independently observed network payloads.
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAssessmentNotification({
  recipientEmail,
  candidateFirstName,
  roleTitle,
  portalToken,
}) {
  // Pass only specific, bounded template variables to external mail infrastructure
  await resend.emails.send({
    from: "Cynbit Opportunities <opportunities@cynbit.in>",
    to: recipientEmail,
    subject: `Technical Assessment Assigned — ${roleTitle}`,
    html: `
      <p>Hi ${candidateFirstName},</p>
      <p>Your technical assessment for the <strong>${roleTitle}</strong> role is ready.</p>
      <p><a href="https://cynbit.in/candidate/verify?token=${portalToken}">Open Assessment Portal</a></p>
      <p><em>This link is time-bounded for your security.</em></p>
    `,
  });
}
```

### B. Public Sub-Processor Transparency

In the public Privacy Policy, maintain a clean sub-processor disclosure table listing third-party cloud data processors, their functional scope, and links to their public compliance terms:

| Sub-Processor | Functional Role | Data Processed | Compliance / DPA Reference |
|---|---|---|---|
| **Resend, Inc.** | Transactional Email Delivery | Recipient email, notification template data | [resend.com/legal/dpa](https://resend.com/legal/dpa) |

*(Note: Internal libraries and ORMs such as Prisma run in-process on application servers and do not represent third-party data processors unless managed cloud database proxy tiers like Prisma Accelerate are contracted).*
