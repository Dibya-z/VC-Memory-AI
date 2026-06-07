/**
 * Built-in sample decks so a reviewer can try the Deal Analyzer and Upload flows
 * WITHOUT having their own VC documents. These are fictional NEW companies (not
 * in the seeded memory), each written to clearly resemble one of the demo
 * companies already in memory — so the analyzer's "similar past deals"
 * comparison produces an obvious, satisfying match.
 *
 *   NovaLedger  → resembles LedgerLite   (Fintech, Invested)
 *   Copilotry   → resembles CodeFlow AI  (Developer Tools, Passed)
 *   GridServe   → resembles CloudBrain AI (AI Infrastructure)
 */

export interface SampleDeck {
  id: string;
  /** Short button label. */
  label: string;
  /** Sector tag shown next to the label. */
  sector: string;
  /** What it should surface — shown as a hint to the reviewer. */
  expectMatch: string;
  /** Filename used when this is sent through the upload flow. */
  filename: string;
  /** The deck body. */
  text: string;
}

export const SAMPLE_DECKS: SampleDeck[] = [
  {
    id: "novaledger",
    label: "NovaLedger",
    sector: "Fintech",
    expectMatch: "Should match LedgerLite (Invested)",
    filename: "novaledger-deck.md",
    text: `# NovaLedger — Seed Pitch Deck

**Tagline:** Embedded accounting for vertical SaaS — add bookkeeping and reconciliation to your platform with one API.

## Problem
Vertical SaaS platforms (for salons, clinics, trades) want to own their customers' financial workflows, but bolting on QuickBooks is brittle and off-mission. Building a correct double-entry ledger in-house is a distraction.

## Solution
NovaLedger is a white-label double-entry ledger and reconciliation API. Drop it in and your platform's customers get invoicing, bank-feed matching, and audit-ready books — multi-entity and multi-currency — without you building any of it.

## Why now
- Embedded finance is expanding from payments into accounting and reconciliation.
- Vertical SaaS platforms are racing to lift revenue per customer.

## Traction
- $480k ARR, growing ~14% month-over-month for five months.
- 11 platform customers; net revenue retention 124%; gross margin ~82%.

## Founders
- **Priya Anand** — CEO. Former product lead at a payments company.
- **Marcus Webb** — CTO. Built ledger infrastructure at two prior fintechs.

## Strengths
- Capital-efficient growth with strong retention.
- A genuine technical moat once embedded — correctness plus switching costs.

## Risks
- Early customer concentration in the top two accounts.
- Embedded finance invites regulatory scrutiny as volume scales.

## The ask
Raising $4M seed to expand the integration catalog and grow go-to-market.`,
  },
  {
    id: "copilotry",
    label: "Copilotry",
    sector: "Developer Tools",
    expectMatch: "Should match CodeFlow AI (Passed)",
    filename: "copilotry-deck.md",
    text: `# Copilotry — Seed Pitch Deck

**Tagline:** An AI pair programmer that learns your codebase — fewer bugs, faster reviews.

## Problem
Generic AI coding assistants don't understand a team's private conventions, so suggestions get ignored and adoption stalls after the novelty wears off.

## Solution
Copilotry indexes your repository and CI history to give context-aware completions, pull-request reviews, and refactors grounded in how your team actually writes code — not generic internet code.

## Why now
- LLMs are good enough that the real bottleneck is context, not raw generation.
- Every engineering team is under pressure to ship more without adding headcount.

## Traction
- 2,400 individual signups, ~30% weekly active.
- $9k MRR on prosumer plans; first team pilots just starting.

## Founders
- **Dani Cohen** — CEO. Former developer-experience lead at a dev-tools company.
- **Sam Okafor** — CTO. Compiler and tooling background.

## Strengths
- Slick demo with clear developer love and fast individual time-to-value.

## Risks
- Individual usage is strong but team-level adoption is unproven.
- Crowded space with well-funded incumbents; the current edge is UX, which is copyable.

## The ask
Raising $3M seed to move from individual to team adoption.`,
  },
  {
    id: "gridserve",
    label: "GridServe",
    sector: "AI Infrastructure",
    expectMatch: "Should match CloudBrain AI",
    filename: "gridserve-deck.md",
    text: `# GridServe — Seed Pitch Deck

**Tagline:** Production LLM inference in your own cloud — open models at low latency, no data leaving your VPC.

## Problem
Enterprises want open-weight models inside their VPC for privacy and cost, but production inference — GPU scheduling, batching, autoscaling, observability — is a whole platform team's worth of work. Most stall at proof-of-concept.

## Solution
GridServe deploys to your Kubernetes cluster and gives you an OpenAI-compatible endpoint with continuous batching, speculative decoding, and per-token cost tracking — all inside the customer's own cloud.

## Why now
- Open models have closed the quality gap for most enterprise tasks.
- Enterprises hold multi-year GPU commitments they want to maximize.

## Traction
- 5 enterprise design partners on free pilots; $0 committed ARR so far.
- Open-source core has ~4,000 GitHub stars.

## Founders
- **Lena Park** — CEO. Ex-staff engineer on a hyperscaler GPU platform.
- **Raj Menon** — CTO. Distributed-systems background; serving-framework contributor.

## Strengths
- Credible infrastructure team with direct large-fleet experience.
- Strong open-source pull and a real privacy/cost wedge.

## Risks
- Open-source vLLM is "good enough" and free for sophisticated teams.
- Long enterprise sales cycles; no paid conversions yet.

## The ask
Raising $4.5M seed to convert design partners to paid.`,
  },
];
