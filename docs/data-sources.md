# ClimateOps Data-Source Catalog

This catalog is the starting point for documenting external data used by ClimateOps. A provider must be reviewed before production use, and each integration should record the exact endpoint, license, update interval, and fallback behavior.

| Data domain | Candidate source | Intended use | Freshness to record | Owner |
|---|---|---|---|---|
| Weather and forecasts | OpenWeather or equivalent approved provider | Temperature, humidity, precipitation, forecasts | Provider timestamp and retrieval time | Backend/data maintainer |
| Historical climate | NASA POWER or equivalent approved provider | Baselines and trend context | Dataset period and retrieval time | Backend/data maintainer |
| India weather warnings | India Meteorological Department (IMD) | Official warnings and heatwave context | Warning issue and expiry time | India monitoring maintainer |
| River and water information | Central Water Commission (CWC), where available | River-level and flood context | Observation timestamp and station | India monitoring maintainer |
| Location search | OpenStreetMap Nominatim or approved geocoder | Location resolution and coordinates | Query time and provider attribution | Backend/data maintainer |

## Required Metadata

Every provider integration should document:

- Provider, endpoint, and version or dataset name.
- Geographic coverage and supported hazards.
- License, attribution, and redistribution constraints.
- Units, coordinate reference system, and timezone.
- Update frequency, observed latency, and retention period.
- Retrieval timestamp, source timestamp, and freshness threshold.
- Validation rules and behavior for missing, stale, or contradictory data.
- Rate limits, authentication requirements, and estimated cost.
- Operational owner and contact path.

## Data Quality Rules

- Preserve the provider timestamp; retrieval time alone is not sufficient.
- Normalize units before risk calculations.
- Reject impossible values and quarantine suspicious records.
- Do not silently replace missing data with a safe-looking value.
- Mark estimates and provider warnings clearly in user-facing output.
- Keep provider attribution where required by the license.

## Review Checklist

- [ ] Terms and license reviewed.
- [ ] Privacy and data-minimization review completed.
- [ ] Freshness and outage behavior documented.
- [ ] Schema and unit mapping documented.
- [ ] Monitoring and alerting owner assigned.
- [ ] Source attribution prepared.
