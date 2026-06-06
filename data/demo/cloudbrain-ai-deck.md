# CloudBrain AI — Seed Pitch Deck

**Tagline:** The inference layer for enterprise AI — run any open model at GPT-class latency, on your own cloud.

## The problem
Enterprises want to deploy open-weight LLMs (Llama, Mistral, Qwen) inside their own VPCs for data-privacy and cost reasons, but getting production-grade inference is hard: GPU scheduling, batching, quantization, autoscaling, and observability are a full platform team's worth of work. Most teams stall at the proof-of-concept stage.

## The solution
CloudBrain AI is a self-hosted inference platform. Point it at your Kubernetes cluster, pick a model from the catalog, and get an OpenAI-compatible endpoint with continuous batching, speculative decoding, and per-token cost tracking. Deploys in the customer's own cloud — no data leaves their boundary.

## Why now
- Open models have closed the quality gap with frontier APIs for most enterprise tasks.
- GPU supply is loosening; enterprises are signing multi-year compute commitments and want to maximize utilization.
- Regulatory pressure (EU AI Act, sector rules) is pushing inference on-prem.

## Traction
- 3 design partners (a regional bank, a healthcare SaaS company, a logistics firm).
- $0 in committed ARR yet — all design partners are on free pilots.
- Open-source core has 2,400 GitHub stars; ~40 self-serve installs/month.

## Business model
Usage-based platform license (per-GPU-hour managed fee) plus an enterprise tier with SSO, audit logs, and support. Target ACV $80–150k.

## Market
Estimated $12B serviceable market in enterprise model-serving by 2028. Competes with vLLM (open source, unmanaged), Baseten, and the hyperscalers' managed endpoints.

## Team
- **Priya Nair** — CEO. Ex-staff engineer on a hyperscaler's GPU platform; led inference infra for a 10k-GPU fleet.
- **Marcus Feld** — CTO. PhD in distributed systems; early contributor to a popular serving framework.
- 4 engineers, all ex-infra.

## The ask
Raising $4M seed to convert design partners to paid, build the enterprise control plane, and hire go-to-market.

## Risks the team acknowledges
- Open-source vLLM is "good enough" for sophisticated teams and is free.
- Sales cycles into regulated enterprises are long (6–9 months).
