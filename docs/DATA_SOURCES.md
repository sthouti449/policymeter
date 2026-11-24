# Data sources — public Virginia AI policy documents

Download each file into `data/sources/` using the **file name** shown. The ingestion script reads `config/sources.manifest.json`, which already lists these files with their metadata (title, issuer, date, status, URL). If you rename a file, update the manifest too.

Checked on 2026-11-23. Links on state websites move; if one fails, use the "Where to find it" column.

| # | File name | Document | Issuer / date | Status | Where to find it |
|---|---|---|---|---|---|
| 1 | `ea400-ai-utilization-policy-2026.pdf` | Artificial Intelligence (AI) Utilization Policy (EA400) | VITA, v1.1, June 30, 2026 | current | https://www.vita.virginia.gov/media/vitavirginiagov/it-governance/ea/pdf/Artificial-Intelligence-(AI)-Utilization-Policy.pdf |
| 2 | `ea225-ai-standard.pdf` | Enterprise Architecture Standard EA-225: ESA Artificial Intelligence | VITA, v1.1, Nov 16, 2023 | current | VITA EA library → Artificial Intelligence → "Artificial Intelligence Standard": https://www.vita.virginia.gov/it-governance/enterprise-architecture/ea-library/ |
| 3 | `cov-ai-policy-standard-2024.pdf` | Policy Standards for the Utilization of AI by the Commonwealth of Virginia | VITA, Jan 17, 2024 | **check** (see note A) | https://www.vita.virginia.gov/media/vitavirginiagov/it-governance/ea/pdf/Utilization-of-Artificial-Intelligence-by-COV-Policy-Standard.pdf |
| 4 | `eo-22-2026.pdf` | Executive Order 22: Data Center Accountability Framework and AI Task Force | Gov. Spanberger, Sept 18, 2026 | current | https://www.governor.virginia.gov/executive-actions/ (EO-22) |
| 5 | `ed-6-2026.pdf` | Executive Directive 6: Preparedness for cyber threats posed by AI | Gov. Spanberger, Oct 23, 2026 | current | https://www.governor.virginia.gov/executive-actions/ (ED-6) |
| 6 | `eo-30-2024.pdf` | Executive Order 30: Implementation of Standards for the Safe Use of AI | Gov. Youngkin, Jan 18, 2024 | **rescinded** (replaced by EO 22) | https://www.governor.virginia.gov/media/governorvirginiagov/governor-of-virginia/pdf/eo/EO-30.pdf |
| 7 | `vita-ai-faqs.pdf` | VITA AI frequently asked questions | VITA, web page | current | https://www.vita.virginia.gov/policy--governance/governance/artificial-intelligence/ai-faqs/ — print the page to PDF |
| 8 | `algorithmic-impact-assessment.pdf` | Algorithmic Impact Assessment template | Office of Data Governance and Analytics | current | https://www.odga.virginia.gov/media/governorvirginiagov/chief-data-officer/Algorithmic-Impact-Assessment.docx — open in Word and save as PDF |
| 9 | `eo30-task-force-report-2026.pdf` | Commonwealth of Virginia AI Strategy: EO 30 Task Force Report | Gov. Youngkin's AI Task Force, Jan 14, 2026 | historical | Search the exact title on governor.virginia.gov |
| 10 (optional) | `jcots-ai-policy-practice-2024.pdf` | Artificial Intelligence: Policy and Practice (JCOTS, RD18) | Joint Commission on Technology and Science, Nov 2024 | historical | https://rga.lis.virginia.gov/Published/2025/RD18/PDF |

### Why this set works for the demo
- **Real governance questions** staff would ask: disclaimers, the AI registry, approved-technology roadmap, impact assessments, agency governance.
- **A built-in "superseded policy" test:** EO 22 rescinds EO 30, while policies published under EO 30 stay in effect until the new task force replaces them. The assistant has to say that correctly, which is a strong demo moment.
- **Fresh material:** EO 22 and ED-6 are from fall 2026, so the panel sees current documents.

### Notes
**A. Status of document 3.** EA400 (June 2026) may consolidate or replace the 2024 policy standard. Before ingesting, read EA400's revision history and "Related policies" section. If EA400 replaces it, set `"status": "rescinded"` and `"replaced_by": "EA400 AI Utilization Policy (June 2026)"` for document 3 in the manifest. If not, set it to `current`.

**B. Scanned pages.** If a PDF yields little text (`pdf-parse` returns under 200 characters per page), the ingest script logs a warning. Re-download a text version or skip it; don't add OCR for this demo.

**C. Re-ingesting.** The ingest script deletes and replaces a document's chunks when the file hash changes, and records `ingested_at`. The UI shows "Documents last ingested: {date}".

## Notes added while loading the documents (November 2026)
- **Direct download links found on the official pages:** EO 22 and ED-6 (governor.virginia.gov, `/media/governorvirginiagov/governor-of-virginia/pdf/eo/` and `/ed/`), EA-225 (`EA-Solutions-Artificial-Intelligence-Standard.pdf` on vita.virginia.gov) and EA400. The original links for EO 30 and the 2024 policy standard now return 404.
- **VITA AI FAQs:** the page hides every answer in a collapsed accordion, so printing it as-is saves only the questions. Open every panel first (remove the `hidden` attributes from `<main>`), then print to PDF. The first attempt kept 944 tokens of text; the expanded copy keeps about 5,850.
- **AI Registry Job Aid (v1.1, October 2026)** was added to the manifest as `ai-registry-job-aid`. About two thirds of its pages are screenshots with almost no text, so it adds little to retrieval (there is no OCR in this demo).
- **Document 3 (2024 policy standard):** EA400's version history lists only EA400's own versions (1.0 on 5/26/2024, 1.1 on 6/30/2026) and does not say it replaces the January 2024 standard, so it stays `current` in the manifest unless a source says otherwise.
- **Algorithmic Impact Assessment (Word file):** this machine has no Office or LibreOffice, so the `.docx` (a zip of XML) was unpacked, its paragraphs and 23 tables were read from `word/document.xml` into a plain HTML page, and Chrome printed that page to `data/sources/algorithmic-impact-assessment.pdf` (22 pages, 41 chunks). Only text is read from the file; the document had no macros. The form's check boxes come through as plain symbols.
- **Task-force report (`eo30-task-force-report-2026.pdf`):** no working link found, so it is not loaded. The eval does not depend on it.
