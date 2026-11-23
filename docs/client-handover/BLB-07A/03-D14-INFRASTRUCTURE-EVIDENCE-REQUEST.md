# 03 — D14 Infrastructure Evidence Request

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-07A — Stakeholder Decision Collection & Approval Request Pack  
**Date prepared:** 2026-11-21  
**Status:** DRAFT REQUEST — NOT SENT — NO APPROVALS RECEIVED

## 1. Purpose

Request D-14 infrastructure evidence required for production confidence (S03/S05/S07 assumptions, D-13 compatibility, D-19 readiness). This is an evidence request only; no infrastructure access is requested or performed.

## 2. Evidence requested

| # | Item | Evidence expected | Owner/role | Date | Notes |
|---:|---|---|---|---|---|
| 1 | Hosting architecture | Diagram/description of frontend, backend, DB, environments, regions | `[Infra/Hosting owner]` | `[PLACEHOLDER]` | No credentials |
| 2 | WAF/CDN/proxy topology | Request flow, provider/config summary, edge controls | `[Infra owner]` | `[PLACEHOLDER]` | Redact sensitive IDs |
| 3 | TLS termination | Where TLS terminates, cert management, HSTS/redirect policy | `[Infra owner]` | `[PLACEHOLDER]` | No private keys |
| 4 | Trusted proxy configuration | Proxy chain, trusted headers, app `trust proxy` alignment | `[Infra/App owner]` | `[PLACEHOLDER]` | Config excerpt/description |
| 5 | Client IP forwarding | Forwarded header policy, spoofing protection | `[Infra owner]` | `[PLACEHOLDER]` |  |
| 6 | Multi-instance deployment | Scaling model, instance count/concurrency, sticky sessions if any | `[Infra owner]` | `[PLACEHOLDER]` |  |
| 7 | Rate-limit coordination | In-process vs distributed/edge rate limiting, store/config | `[Infra/App owner]` | `[PLACEHOLDER]` |  |
| 8 | Environment ownership | Owner matrix for dev/staging/UAT/prod | `[Client/Ops]` | `[PLACEHOLDER]` |  |
| 9 | Secret storage and rotation | Vault/platform, rotation cadence, access control, transfer process | `[Security/Ops]` | `[PLACEHOLDER]` | **No secrets/passwords/API keys/private keys** |
| 10 | Logging and retention | Platform, retention period, PII redaction, access control | `[Ops/Security]` | `[PLACEHOLDER]` |  |
| 11 | Backup and restore | Schedule, RPO/RTO, restore drill evidence, ownership | `[DBA/Ops]` | `[PLACEHOLDER]` |  |
| 12 | Deployment rollback | Rollback procedure, triggers, authority, last drill evidence | `[Release/Ops]` | `[PLACEHOLDER]` |  |
| 13 | Monitoring and incident ownership | Alerting, on-call/escalation, incident process | `[Ops/Client]` | `[PLACEHOLDER]` |  |

## 3. Security handling

- Do not provide passwords, API secrets, private keys, or credentials in this response.
- Provide redacted screenshots, config descriptions, architecture diagrams, or controlled document references where possible.
- Mark sensitive evidence as restricted and share through an approved secure channel.

## 4. Boundaries

Request draft only; not sent. Evidence receipt != infrastructure change authorization != production release authorization.