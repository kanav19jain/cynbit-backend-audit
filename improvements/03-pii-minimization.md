# Finding 3 — Candidate PII Scope & Data Minimization Hygiene

> **Classification:** VERIFIED (Public Form Fields) + 💡 RECOMMENDED (Architectural Guidance)

---

## Observable Context

The public internship application form (`/careers/backend-developer-intern`) collects candidate information across multiple categories:

| Category | Observable Form Attributes | Primary Evaluation Relevance |
|---|---|---|
| **Identity & Contact** | Full Name, Email, Phone Number | Core identification & communication |
| **Direct Messaging** | WhatsApp Number | Secondary channel (often redundant with phone/email) |
| **Demographics** | Date of Birth, Gender | Administrative / onboarding details |
| **Location Data** | Current City, Permanent Address | City reflects work mode; full address is administrative |
| **Academic Records** | Degree, Institution, Grad Year, CGPA / % | Relevant to intern eligibility criteria |
| **Technical Footprint** | Portfolio Link, LinkedIn URL, GitHub / Behance | Direct engineering evaluation artifacts |

---

## Engineering & Data Privacy Considerations

From an architectural and data governance standpoint (aligning with principles such as the Digital Personal Data Protection Act, 2023, and GDPR Art. 5):

1. **Minimizing the Intake Surface Area:**  
   Every persisted data point carries operational overhead (encryption, storage, backups, and potential exposure risk in the event of an internal leak). Attributes like permanent home addresses and exact dates of birth provide minimal value during initial technical screening.
2. **Defensible Data Lifecycles:**  
   Candidate repositories naturally accumulate historical submissions. Without defined automated retention or anonymization lifecycles, obsolete personal records persist indefinitely in relational storage.

---

## Practical Architectural Recommendations

### 1. Phased Data Intake

Adopt a progressive submission flow:
- **Phase 1 (Application):** Name, Email, Current City, Skills, GitHub/Portfolio, and Resume.
- **Phase 2 (Interview / Assessment):** Phone number and scheduling constraints.
- **Phase 3 (Offer & Background Verification):** Date of Birth, Permanent Address, and Official Identifiers.

### 2. Scheduled Data Retention & Comprehensive Anonymization Worker

Implement a background worker (e.g., a scheduled Next.js Route Handler or cron job) that systematically purges or anonymizes all direct and indirect personal identifiers for inactive or rejected candidate profiles after a defined holding period (e.g., 180 days).

```typescript
/**
 * Example: Comprehensive Candidate Record Anonymization Handler (Prisma + Node.js)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function anonymizeStaleApplications(retentionDays = 180) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.candidateApplication.updateMany({
    where: {
      status: "REJECTED",
      updatedAt: { lt: cutoffDate },
      isAnonymized: false,
    },
    data: {
      // 1. Redact direct personal identifiers
      fullName: "Anonymized Candidate",
      email: "anonymized@retention.local",
      phone: null,
      whatsapp: null,
      dateOfBirth: null,
      permanentAddress: null,
      currentCity: null,

      // 2. Strip external portfolio & professional links
      resumeFileUrl: null,
      portfolioUrl: null,
      linkedInUrl: null,
      githubUrl: null,
      applicationStatement: "[redacted pursuant to retention policy]",

      // 3. Mark record as anonymized (retains university, score, roleId for historical cohort metrics)
      isAnonymized: true,
    },
  });

  return { anonymizedCount: result.count };
}
```
