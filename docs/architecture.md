# ClimateOps Architecture Reference

## System Context

```text
User
  -> Frontend
       -> Backend API
            -> Location and climate-data providers
            -> Risk and simulation engines
            -> AI explanation service
            -> Database and cache
            -> Monitoring and notification services
```

## Responsibilities

| Area | Responsibility |
|---|---|
| Frontend | Location search, risk presentation, simulations, monitoring views, and accessible user feedback |
| API | Authentication, validation, request orchestration, response contracts, and error reporting |
| Data adapters | Provider-specific authentication, retrieval, normalization, attribution, and freshness metadata |
| Risk engine | Deterministic hazard calculations and severity mapping |
| AI explanation | Plain-language explanations and recommendations from structured risk results |
| Monitoring | Scheduled retrieval, incident detection, deduplication, lifecycle updates, and notifications |
| Persistence | Locations, observations, incidents, timelines, and audit-relevant metadata |

## Data Flow Principles

1. External data is untrusted until validated and normalized.
2. Risk calculations should be reproducible from stored inputs and algorithm versions.
3. AI-generated text must explain structured results, not invent measurements or official warnings.
4. Responses should expose source and freshness information.
5. Failures and stale data should be visible rather than represented as low risk.

## Operational Boundaries

- Provider outages must not be hidden by fabricated values.
- Secrets belong in runtime configuration, never in source or documentation.
- Personal data should be minimized and retained only for a documented purpose.
- Emergency notifications need an owner, escalation path, and delivery monitoring.
- Changes to risk thresholds or severity labels require review and documentation.
