# ClimateOps User Flows

These flows describe intended user behavior and the information the product should make clear. They are product references, not implementation specifications.

## Location Risk Assessment

```text
Open ClimateOps
  -> Search for a location
  -> Confirm the resolved place and timestamp
  -> View heat, flood, water-stress, and drought risk
  -> Inspect contributing factors and source freshness
  -> Read recommended precautions
  -> Check official guidance before taking action
```

## What-If Simulation

```text
Open a location assessment
  -> Choose a supported scenario
  -> Change one or more conditions
  -> Review current versus simulated values
  -> Read assumptions and uncertainty
  -> Reset or save the scenario for discussion
```

## Emergency Monitoring

```text
Open the monitoring view
  -> Select a monitored region
  -> Review active incidents and last update time
  -> Open an incident timeline
  -> Check source warnings and confidence
  -> Follow official response instructions
  -> Track status changes until resolved
```

## Missing or Stale Data

```text
User requests a location or incident
  -> System detects missing or stale source data
  -> Explain what is unavailable and when it was last updated
  -> Show only supported results with clear uncertainty
  -> Provide a retry or alternative source path
  -> Direct users to official authorities for urgent decisions
```

## Accessibility Expectations

- Important risk information must not rely on color alone.
- Severity labels should be written plainly.
- Keyboard and screen-reader users should be able to reach the same actions.
- Alerts should identify the affected place, time, source, and recommended next step.
