# Security Policy

## Scope

This policy covers the ClimateOps repository, its documentation, deployed services, and integrations operated by the project.

## Reporting a Vulnerability

Do not disclose security vulnerabilities in a public issue, pull request, or discussion. Report them privately through the repository's supported private security-reporting channel. If that channel is unavailable, contact the project maintainers privately and include **ClimateOps security report** in the subject.

Please include:

- A clear description of the issue and its impact.
- Affected component, endpoint, or configuration.
- Reproduction steps or a proof of concept that does not access real user data.
- Any prerequisites, permissions, or environmental assumptions.
- Suggested mitigation, if known.

Please redact tokens, personal data, and operational secrets from reports.

## Response Expectations

Maintainers will acknowledge a report as soon as practical, validate the issue, and coordinate a fix or mitigation. Timelines may vary depending on severity and whether coordinated disclosure is required.

## Security Practices

- Keep secrets in environment variables or an approved secret manager.
- Do not commit `.env` files, credentials, tokens, or private datasets.
- Validate and authorize external inputs.
- Apply least-privilege access to data providers, databases, queues, and deployment systems.
- Log security-relevant events without logging secrets or unnecessary personal data.
- Review third-party dependencies and data-provider terms before adoption.
- Treat environmental data as untrusted input and record its source and freshness.

## Emergency and Safety Boundary

ClimateOps is an information and decision-support platform. It does not replace official emergency alerts, public authorities, medical advice, or emergency services. Security fixes must preserve this boundary and must not create misleading confidence in risk results.
