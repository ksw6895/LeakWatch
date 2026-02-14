# Shopify Embedded Financial UX Research (2026-02-15)

## Goal

Provide backlog-ready UX guidance for LeakWatch's Shopify embedded experience in financial/reconciliation workflows, grounded in:

1. Current LeakWatch implementation
2. Official Shopify guidance
3. High-signal Shopify implementation examples

## Scope and evidence boundaries

- Focus areas requested: onboarding friction, embedded navigation expectations, long-running background jobs, and data-confidence communication.
- Only cited claims are included.
- Platform rules are drawn from Shopify documentation and Built for Shopify requirements.

## Current-state snapshot (LeakWatch)

- Embedded auth/session wiring exists: App Bridge provider is initialized with `host` and API key, and API calls fetch session tokens per request. [C1] [C2] [C3]
- Primary navigation is currently a custom in-app header nav, not Shopify app-nav web component. [C4]
- Upload processing has explicit multi-stage statuses and 5s polling while jobs are running. [C5] [C6] [C7]
- Document detail exposes stage-by-stage pipeline and failure details; findings expose confidence and evidence; actions expose parse-quality metrics. [C7] [C8] [C9] [C10] [C11]
- No explicit onboarding/setup-guide flow exists in current web code. [C12]
- Settings forms use page-level save buttons, not contextual save bar behavior. [C13]

## Official Shopify expectations and practical guidance

### 1) Onboarding friction

What Shopify expects:

- Embedded apps should keep primary workflows in Shopify Admin and avoid extra login prompts for standard self-serve installs. [S1] [S2]
- Onboarding should be brief, direct, usually <= 5 steps, ask only necessary info, and be dismissible or resumable if non-essential. [S3] [S4]
- App home should communicate status and immediate next actions, not just static links. [S5] [S6]

Practical guidance for LeakWatch:

- Use a short setup guide on `/app` with explicit first-value milestones (connect context -> upload first invoice -> review first finding -> create first action draft).
- Keep "continue later" and persist dismiss/progress state.
- Avoid asking for optional fields before users see first detection value.

### 2) Polaris/embedded navigation expectations

What Shopify expects:

- Navigation is a core IA surface; app nav + app header + page title should make location and next steps obvious. [S7] [S8]
- Use Shopify app nav (`s-app-nav` / App Bridge nav), keep labels short, and avoid duplicate homepage nav items. [S7] [S8] [S9]
- Built for Shopify explicitly checks for using Shopify nav patterns and highlights nav-related rejection reasons. [S2]

Practical guidance for LeakWatch:

- Move primary nav from custom header links to Shopify app nav component.
- Keep top-level nav to high-signal nouns (Dashboard, Uploads, Leaks, Actions, Reports, Settings, Agency) and avoid duplicating the same nav in app body.
- Keep detail pages with clear in-flow "Back" actions and strong active-state signaling.

### 3) Handling long-running background jobs

What Shopify expects:

- Home and key pages should provide ongoing status updates and actionable monitoring signals. [S1] [S5]
- Distinguish task alerts vs system alerts: use toasts for short non-critical confirmations, banners for persistent/system conditions and clear next steps. [S10] [S11] [S12]
- Loading indicators should be contextual and accessible; avoid full-page spinner overuse. [S13]

Practical guidance for LeakWatch:

- Keep stage-based job model visible (upload, extraction, normalization, detection), but add clearer persistent system alerts for failures/quota blocks.
- Replace one-off timeout refresh patterns with explicit job-state polling/subscription semantics where possible.
- Use a consistent alert matrix:
  - Success action feedback: toast
  - Recoverable system condition: warning banner + CTA
  - Blocking failure: critical banner + troubleshooting path

### 4) Communicating data confidence

What Shopify expects:

- Monitoring/reporting should be visible in-admin and useful for daily decisions. [S1] [S5]
- Apps must avoid false claims and manipulative certainty language (Built for Shopify). [S2]
- Status signals should be concise/scannable and paired with clear next actions. [S10] [S11]

Practical guidance for LeakWatch:

- Keep showing confidence and evidence, but add confidence interpretation bands and uncertainty language.
- Pair confidence with evidence quality indicators (e.g., number/type of evidence refs, parse quality stats) so merchants understand why a score is high/low.
- Add explicit copy policy for financial claims ("estimated", "potential", "not guaranteed") to stay aligned with platform trust requirements.

## High-signal implementation examples

- Shopify React Router template uses embedded `AppProvider`, admin authentication guard, and `s-app-nav` in app shell. [E1] [E2]
- Shopify Function sample app uses App Bridge `NavigationMenu` in app layout and auth-aware fetch with reauthorization header handling. [E3] [E4]

These are strong references for aligning LeakWatch with current embedded app architecture and navigation/auth expectations.

## Backlog-ready recommendations

| ID | Area | Recommendation | Acceptance criteria | Evidence |
| --- | --- | --- | --- | --- |
| UX-01 | Onboarding | Add `/app` setup guide (3-5 steps) with progress and dismiss/resume state | Setup guide shows progress count, per-step completion, dismiss, and restore on reload | [S3] [S4] [S6] [C12] |
| UX-02 | Onboarding | Reorder first-run flow to reach "first finding" before optional config | New stores can upload + process first invoice without being blocked by optional fields | [S3] [S5] [C5] [C13] |
| UX-03 | Navigation | Migrate primary nav to `s-app-nav`/App Bridge nav and remove custom primary header nav | Primary route switching uses Shopify nav component; active state is correct for nested routes | [S7] [S8] [S9] [S2] [C4] [E1] [E3] |
| UX-04 | Navigation | Trim duplicated navigation in app body (keep quick actions contextual, not parallel nav) | Dashboard no longer replicates global nav structure as another menu | [S7] [S8] [C14] |
| UX-05 | Background jobs | Introduce unified job-status panel (running/failed/completed) with per-stage counters | Upload/report pages show live stage counters and last update timestamp | [S1] [S5] [S10] [C5] [C7] |
| UX-06 | Background jobs | Replace delayed timeout refresh in report generation with explicit job-state tracking | Report generation shows queued/running/done states without hardcoded timeout refresh | [S10] [S11] [C15] |
| UX-07 | Alerts | Implement alert matrix (toast vs banner vs inline error) and remove transient error toasts | Error conditions render inline/banner; non-critical success uses short toast; each alert has CTA where needed | [S10] [S11] [S12] [C5] [C13] |
| UX-08 | Mobile | Reduce horizontal-scroll dependency in critical tables via mobile card/list fallback | Leaks/actions/documents tables have mobile-optimized card mode under narrow widths | [S14] [S7] [C7] [C8] [C9] |
| UX-09 | Confidence | Add confidence bands (High/Medium/Low) with explanation tooltip/modal | Every finding shows numeric score + band + "how calculated" explainer | [S1] [S2] [C8] [C10] |
| UX-10 | Confidence | Add evidence-quality metadata near confidence (evidence count/types, parse quality context) | Finding detail includes evidence coverage summary and link to parse-quality metrics | [S5] [S10] [C8] [C9] [C11] |
| UX-11 | Trust language | Add financial-claim copy standard (estimated/potential, no guarantees) | UI copy and report templates avoid deterministic savings promises | [S2] [C8] [C14] |
| UX-12 | Settings UX | Adopt contextual save behavior for settings forms where applicable | Unsaved changes show contextual save/discard behavior and leave confirmation | [S2] [S15] [C13] |

## Suggested implementation order

1. UX-03, UX-01, UX-05 (structural UX alignment)
2. UX-06, UX-07, UX-12 (interaction reliability)
3. UX-09, UX-10, UX-11 (decision trust and confidence communication)
4. UX-08 (mobile optimization pass)

## Sources

### Shopify docs

- [S1] Integrating with Shopify admin: https://shopify.dev/docs/apps/build/integrating-with-shopify
- [S2] Built for Shopify requirements: https://shopify.dev/docs/apps/launch/built-for-shopify/achievement-criteria
- [S3] Onboarding UX guideline: https://shopify.dev/docs/apps/design/user-experience/onboarding
- [S4] Setup guide pattern: https://shopify.dev/docs/api/app-home/patterns/compositions/setup-guide
- [S5] App home page UX guideline: https://shopify.dev/docs/apps/design/user-experience/app-home-page
- [S6] Homepage template pattern: https://shopify.dev/docs/api/app-home/patterns/templates/homepage
- [S7] Navigation design guideline: https://shopify.dev/docs/apps/design/navigation
- [S8] App structure guideline: https://shopify.dev/docs/apps/design/app-structure
- [S9] App nav component: https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav
- [S10] Alerts guideline (task/system alerts): https://shopify.dev/docs/apps/design/user-experience/alerts
- [S11] Banner component guidance: https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-and-status-indicators/banner
- [S12] Toast API: https://shopify.dev/docs/api/app-home/apis/toast
- [S13] Spinner guidance: https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-and-status-indicators/spinner
- [S14] Mobile support best practices: https://shopify.dev/docs/apps/build/mobile-support
- [S15] Save bar API: https://shopify.dev/docs/api/app-home/apis/save-bar

### High-signal Shopify example code

- [E1] Embedded app shell with admin auth + app nav (`shopify-app-template-react-router`): https://github.com/Shopify/shopify-app-template-react-router/blob/299560082dbba451bc95fa4fab67b178168f31f6/app/routes/app.tsx#L8-L25
- [E2] Embedded app server configuration (`shopify-app-template-react-router`): https://github.com/Shopify/shopify-app-template-react-router/blob/299560082dbba451bc95fa4fab67b178168f31f6/app/shopify.server.ts#L10-L34
- [E3] App Bridge navigation menu usage (`function-examples`): https://github.com/Shopify/function-examples/blob/19ccafceda1d0052c2c90c0a1e4db3fe37b16c27/sample-apps/bundles-cart-transform/web/frontend/App.jsx#L21-L29
- [E4] Reauthorization-aware fetch hook (`function-examples`): https://github.com/Shopify/function-examples/blob/19ccafceda1d0052c2c90c0a1e4db3fe37b16c27/sample-apps/bundles-cart-transform/web/frontend/hooks/useAuthenticatedFetch.js#L17-L40

### LeakWatch codebase references

- [C1] `apps/web/src/app/(embedded)/app/embedded-providers.tsx:14`
- [C2] `apps/web/src/lib/api/fetcher.ts:24`
- [C3] `apps/web/src/lib/shopify/session-token.ts:8`
- [C4] `apps/web/src/app/(embedded)/app/embedded-layout-client.tsx:14`
- [C5] `apps/web/src/components/uploads-panel.tsx:49`
- [C6] `apps/web/src/components/uploads-panel.tsx:220`
- [C7] `apps/web/src/app/(embedded)/app/documents/[documentId]/page.tsx:80`
- [C8] `apps/web/src/app/(embedded)/app/leaks/[id]/page.tsx:186`
- [C9] `apps/web/src/app/(embedded)/app/actions/page.tsx:191`
- [C10] `apps/api/src/modules/auth/tenant-prisma.service.ts:684`
- [C11] `apps/worker/src/jobs/detection.ts:45`
- [C12] `apps/web/src/` search for onboarding/setup-guide: no matches (2026-02-15)
- [C13] `apps/web/src/app/(embedded)/app/settings/page.tsx:79`
- [C14] `apps/web/src/components/embedded-shell.tsx:131`
- [C15] `apps/web/src/app/(embedded)/app/reports/page.tsx:168`
