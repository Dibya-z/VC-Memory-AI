# InferGrid — Seed Pitch Deck

**Tagline:** Run any open model in your own cloud at GPT-class latency — self-hosted LLM inference for the enterprise.

## The problem
Enterprises want to deploy open-weight LLMs (Llama, Mistral, Qwen) inside their own VPCs for privacy and cost control, but production-grade inference — GPU scheduling, batching, quantization, autoscaling, observability — is a whole platform team's worth of work. Most stall at proof-of-concept.

## The solution
InferGrid is a self-hosted inference platform. Point it at your Kubernetes cluster, pick a model, and get an OpenAI-compatible endpoint with continuous batching, speculative decoding, and per-token cost tracking — all inside the customer's own cloud.

## Why now
- Open models have closed the quality gap for most enterprise tasks.
- Enterprises hold multi-year GPU commitments and want to maximize utilization.
- Regulation is pushing inference on-prem.

## Traction
- 4 enterprise design partners (a bank, a healthcare SaaS firm, a telco) — all on free pilots.
- $0 committed ARR so far.
- Open-source core has ~3,000 GitHub stars; ~50 self-serve installs/month.

## Business model
Usage-based managed fee per GPU-hour, plus an enterprise tier with SSO, audit logs, and support. Target ACV $90–150k.

## Founders
- **Wei Chen** — CEO. Ex-staff engineer on a hyperscaler GPU platform.
- **Diego Morales** — CTO. Distributed-systems PhD; contributor to a popular serving framework.

## Strengths
- Credible infra team with direct large-fleet experience.
- Strong open-source pull and a real privacy/cost wedge.

## Risks the team acknowledges
- Open-source vLLM is "good enough" and free for sophisticated teams.
- Enterprise sales cycles run 6–9 months; no paid conversions yet.

## The ask
Raising $4.5M seed to convert design partners to paid and build the enterprise control plane.
