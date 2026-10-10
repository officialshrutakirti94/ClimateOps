# ClimateOps — Hackathon Project Plan

## 1. Hackathon Track

### Track 02 — Heat and Water

> **Too much water, too little of it, and the heat in between. Build for the monsoon that floods the street and the summer that dries the tap.**

The track focuses on:

* Heatwaves
* Floods
* Monsoon waterlogging
* Droughts
* Water tankers
* Leaks
* Groundwater

---

# 2. Project

## Documentation and Governance Roadmap

The project maintains these non-code references alongside implementation work:

- `CONTRIBUTING.md` for branches, reviews, documentation, and contribution expectations.
- `SECURITY.md` for private vulnerability reporting and security practices.
- `.github/` templates for consistent bug reports, feature requests, and pull requests.
- `docs/data-sources.md` for provider ownership, freshness, licensing, and quality requirements.
- `docs/user-flows.md` for intended user journeys and accessibility expectations.
- `docs/architecture.md` for system boundaries and data-flow principles.
- `docs/manual-qa.md` for repeatable release and regression checks.
- `docs/risk-and-safety.md` for uncertainty, emergency guidance, privacy, and safety review.

Review documentation whenever a data source, risk threshold, alert, user flow, operational process, or public-facing limitation changes.

## ClimateOps — Climate Intelligence & Emergency Response

ClimateOps is an AI-powered platform that turns environmental data into **risk intelligence, preventive decisions, and live emergency monitoring**.

The platform has two major capabilities:

### 🌍 Climate Intelligence

Global, on-demand climate risk analysis.

### 🚨 India Emergency Ops

Continuous monitoring and emergency detection for India.

---

# 3. Core Idea

Most environmental platforms tell users **what is happening**.

ClimateOps focuses on:

> **What is happening → Why it matters → What could happen next → What should be done.**

Core loop:

```text
OBSERVE
   ↓
ANALYZE
   ↓
PREDICT
   ↓
SIMULATE
   ↓
DECIDE
   ↓
MONITOR
   ↓
RESPOND
   ↓
RECOVER
```

---

# 4. Feature 1 — 🌍 Climate Intelligence

### Global Location Search

Users can search for any location in the world.

Example:

```text
Dubai
London
Mumbai
Tokyo
New York
```

The system retrieves environmental data and calculates:

* Heat Risk
* Flood Risk
* Water Stress
* Drought Risk

### Flow

```text
User searches location
        ↓
Location resolution
        ↓
Environmental data
        ↓
Risk Engine
        ↓
Risk assessment
        ↓
Groq (via LangChain)
        ↓
Explanation + recommendations
```

---

## 4.1 Climate Risk Dashboard

Example:

```text
Dubai, UAE

Heat Risk       82%  HIGH
Flood Risk      12%  LOW
Water Stress    76%  HIGH
Drought Risk    54%  MEDIUM
```

For every risk show:

* Score
* Severity
* Contributing factors
* Trend
* Data source

---

## 4.2 Preventive Recommendations

Groq receives structured risk information and explains:

```text
Why is the risk high?

What factors are contributing?

What should people/organizations consider doing?
```

Example:

```text
High heat risk is primarily driven by
elevated temperatures and continued
forecast heat.

Recommended priorities:
• Reduce peak-hour exposure
• Increase cooling efficiency
• Monitor water consumption
```

---

# 5. Feature 1.5 — What-if Simulation

Users can change environmental conditions and see how risk changes.

Example:

```text
Temperature: +3°C
Rainfall: -30%
```

Output:

```text
                    CURRENT    SIMULATION

Heat Risk             82%         94%
Water Stress          76%         88%
Flood Risk             12%         14%
```

The **Risk Engine calculates the numbers**.

Groq explains the impact.

This allows users to ask:

> **"What happens if conditions get worse?"**

---

# 6. Feature 2 — 🚨 India Live Emergency Ops

The second feature is focused specifically on **India**.

Instead of waiting for a user to search for a location, ClimateOps continuously monitors selected Indian locations.

### It detects:

* Heatwaves
* Flood conditions
* Heavy rainfall
* Monsoon waterlogging risk
* Drought/water stress
* Rapidly changing environmental conditions

Future extensions can include:

* Water tanker demand
* Water leaks
* Groundwater stress

---

# 7. Live Monitoring Architecture

```text
              OFFICIAL DATA SOURCES
                       │
              ┌────────┼────────┐
              ↓        ↓        ↓
             IMD      CWC    Government
              │        │        │
              └────────┼────────┘
                       ↓
                Data Adapter Layer
                       ↓
                 Normalized Data
                       ↓
                  Risk Engine
                       ↓
               Emergency Engine
                       ↓
                Incident Created
                       ↓
             5-Minute Monitoring
                       ↓
                  DynamoDB
                       ↓
                Live Dashboard
```

---

# 8. Live Data Sources

## India Meteorological Department — IMD

Primary source for:

* Current weather
* Rainfall
* District warnings
* Nowcasts
* Forecasts
* Weather observations

IMD's API documentation provides endpoints for current weather, district rainfall, district warnings, nowcasts, AWS observations, and other meteorological data.

Source:

https://mausam.imd.gov.in/imd_latest/contents/api.pdf

---

## Central Water Commission — CWC

Potential source for:

* River levels
* River-level trends
* Flood-related information
* Hydrological observations

CWC should be implemented through a separate adapter so the rest of the system does not depend directly on its response format.

---

# 9. Data Adapter Layer

External APIs should never directly feed the Risk Engine.

```text
IMD
 ↓
IMD Adapter
 ↓
Normalized Environmental Data

CWC
 ↓
CWC Adapter
 ↓
Normalized Environmental Data
```

Common internal structure:

```json
{
  "locationId": "IN-AS-GUW",
  "timestamp": "...",

  "weather": {
    "temperature": 38.4,
    "humidity": 78,
    "rainfall": 92
  },

  "water": {
    "riverLevel": 48.2,
    "riverLevelTrend": "RISING"
  },

  "alerts": []
}
```

---

# 10. Risk Engine

The Risk Engine determines environmental risk using deterministic logic.

Initial categories:

```text
Heat Risk
Flood Risk
Water Stress
Drought Risk
```

Risk levels:

```text
0–30     LOW
31–60    MEDIUM
61–80    HIGH
81–100   CRITICAL
```

Example:

```text
Rainfall ↑
River level ↑
Official flood warning
        ↓
Flood Risk = 91%
        ↓
CRITICAL
```

### Important

The LLM does **not** decide whether something is an emergency.

```text
Environmental Data
        ↓
Risk Engine
        ↓
Emergency Engine
        ↓
Emergency detected
        ↓
Groq
        ↓
Explanation + Recommendations
```

---

# 11. Emergency Engine

The Emergency Engine converts high-risk environmental conditions into incidents.

Example:

```text
IF

Flood Risk >= 80
AND
Official Warning = TRUE

THEN

Create/Update Flood Incident
```

Incident example:

```json
{
  "incidentId": "INC-1024",
  "locationId": "IN-AS-GUW",
  "type": "FLOOD",
  "severity": "CRITICAL",
  "status": "ACTIVE",
  "riskScore": 94
}
```

---

# 12. Five-Minute Monitoring

Active incidents are continuously reassessed.

Use:

**Amazon EventBridge Scheduler → AWS Lambda**

Do NOT use a permanent Python sleep loop.

```text
Incident Created
      ↓
EventBridge Scheduler
      ↓
Lambda
      ↓
Fetch latest data
      ↓
Risk Engine
      ↓
Update Incident
      ↓
Push UI update
      ↓
Next 5-minute check
```

Example:

```text
10:00 → Risk 82%
10:05 → Risk 86%
10:10 → Risk 94%
10:15 → Risk 88%
10:20 → Risk 71%
10:25 → Risk 48%
10:30 → RESOLVED
```

---

# 13. Incident Lifecycle

```text
MONITORING
     ↓
WARNING
     ↓
CRITICAL
     ↓
EXTREME
     ↓
RECOVERY
     ↓
RESOLVED
```

The same incident should be updated rather than creating duplicate incidents every five minutes.

---

# 14. Live Emergency Command Center

Main dashboard:

```text
┌─────────────────────────────────────────────┐
│ CLIMATEOPS — INDIA EMERGENCY COMMAND CENTER │
├─────────────────────────────────────────────┤
│                                             │
│ 🔴 ACTIVE INCIDENTS       04                │
│ 🟠 HIGH RISK              08                │
│ 🟢 MONITORED             126                │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ 🔴 FLOOD       Assam          CRITICAL      │
│ 🟠 HEAT        Rajasthan      HIGH          │
│ 🔴 HEAVY RAIN  West Bengal    CRITICAL      │
│ 🟠 FLOOD       Bihar          HIGH          │
│                                             │
└─────────────────────────────────────────────┘
```

---

# 15. Incident Details

Selecting an incident:

```text
INCIDENT #INC-1024

Location: Guwahati, Assam
Type: FLOOD
Severity: CRITICAL

Flood Risk       94%
Rainfall         126 mm
River Level      48.2 m
River Trend      ↑ RISING

Official Warning ✓ VERIFIED

Last Assessment  10:40 AM
Next Assessment  10:45 AM
```

---

# 16. Explainable Emergency Detection

Every incident should show:

```text
WHY IS THIS AN EMERGENCY?

✓ Heavy rainfall detected
✓ River level rising
✓ Official warning detected
✓ Flood risk above critical threshold
✓ Risk increased from 91% → 94%
```

This makes the system transparent rather than being a black-box AI application.

---

# 17. Live Incident Timeline

```text
10:35 ✓ Official warning detected
10:35 ✓ Incident created
10:36 ✓ Risk calculated: 91%
10:40 ✓ New environmental data received
10:40 ⚠ Risk increased: 91% → 94%
10:45 ✓ Monitoring continues
```

Frontend receives updates through:

```text
WebSocket / SSE
```

No page refresh required.

---

# 18. Groq AI Decision Support

Groq is the **AI decision-support layer**.

It receives structured information such as:

```json
{
  "incidentType": "FLOOD",
  "severity": "CRITICAL",
  "rainfall": 126,
  "riverLevel": 48.2,
  "riverTrend": "RISING",
  "officialWarning": true,
  "riskScore": 94
}
```

It generates:

* Situation summary
* Risk explanation
* Contributing factors
* Recommended priorities
* Potential impact

---

# 19. AWS Architecture

```text
                         React
                           │
                           ▼
                     API Gateway
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
          Backend API             WebSocket/SSE
              │                         ▲
              ▼                         │
          DynamoDB                     │
              ▲                         │
              │                         │
        Risk / Incident Engine          │
              ▲                         │
              │                         │
          AWS Lambda ──────────────────┘
              ▲
              │
      EventBridge Scheduler
              │
          Every 5 min
```

AI:

```text
Risk Engine
    ↓
Groq (via LangChain)
    ↓
AI Insights
```

Storage:

```text
Raw / historical data
        ↓
       S3
```

---

# 20. Main AWS Services

### Required/Core

* Groq API (via LangChain)
* AWS Lambda
* Amazon EventBridge Scheduler
* Amazon DynamoDB
* Amazon API Gateway
* Amazon S3

### Optional

* Amazon CloudWatch
* Amazon Location Service
* Amazon SageMaker

The goal is **meaningful AWS integration**, not using as many AWS services as possible.

---

# 21. Database

Minimum entities:

```text
locations
environmental_observations
risk_assessments
incidents
incident_observations
simulation_runs
```

Example:

### locations

```text
locationId
country
state
district
city
latitude
longitude
```

### incidents

```text
incidentId
locationId
type
severity
status
source
createdAt
lastUpdated
lastChecked
nextCheck
```

### incident_observations

```text
incidentId
timestamp
rainfall
temperature
riverLevel
riskScore
severity
source
```

---

# 22. Simulation Mode

For the hackathon demo, add a clearly labeled:

```text
⚠ SIMULATION MODE
```

Example:

```text
Current rainfall: 80mm

Simulate:
+50% rainfall
```

Result:

```text
Flood Risk
61% → 89%

Severity
HIGH → CRITICAL

Simulated Incident
CREATED
```

Simulation must use the same Risk Engine as real monitoring.

---

# 23. API Structure

## Climate Intelligence

```http
GET /api/locations/search?q=dubai

GET /api/climate/{locationId}

POST /api/climate/{locationId}/simulate
```

---

## Emergency Ops

```http
GET /api/incidents/active

GET /api/incidents/{incidentId}

GET /api/incidents/{incidentId}/timeline

GET /api/monitoring/locations

POST /api/incidents/simulate
```

---

# 24. Implementation Roadmap

## Phase 1 — Foundation

* [ ] Repository
* [ ] React frontend
* [ ] Backend
* [ ] AWS configuration
* [ ] DynamoDB
* [ ] S3
* [ ] Environment configuration

---

## Phase 2 — Global Climate Intelligence

* [ ] Global location search
* [ ] Environmental data provider
* [ ] Data normalization
* [ ] Risk Engine
* [ ] Climate dashboard
* [ ] Groq/LangChain integration
* [ ] Preventive recommendations

---

## Phase 3 — What-if Simulation

* [ ] Simulation API
* [ ] Simulation UI
* [ ] Risk recalculation
* [ ] Current vs simulated comparison
* [ ] Groq explanation

---

## Phase 4 — India Live Monitoring

* [ ] IMD client
* [ ] Current weather
* [ ] District rainfall
* [ ] District warnings
* [ ] Data normalization
* [ ] Monitored-location configuration

---

## Phase 5 — Emergency Engine

* [ ] Heat detection
* [ ] Flood detection
* [ ] Water-stress detection
* [ ] Drought detection
* [ ] Incident creation
* [ ] Incident lifecycle
* [ ] Incident history

---

## Phase 6 — Continuous Monitoring

* [ ] EventBridge Scheduler
* [ ] Monitoring Lambda
* [ ] Five-minute reassessment
* [ ] Risk updates
* [ ] Incident resolution
* [ ] Historical observations

---

## Phase 7 — Live Command Center

* [ ] India dashboard
* [ ] Active incident list
* [ ] Incident details
* [ ] Risk visualization
* [ ] Incident timeline
* [ ] WebSocket/SSE
* [ ] Live updates
* [ ] "Why is this an emergency?"

---

## Phase 8 — CWC Integration

* [ ] Research accessible CWC feeds
* [ ] CWC adapter
* [ ] River levels
* [ ] River trends
* [ ] Improve flood-risk calculation

---

## Phase 9 — AI Decision Support

* [ ] Groq prompts
* [ ] Incident summaries
* [ ] Risk explanations
* [ ] Recommended actions
* [ ] Guardrails
* [ ] Trigger AI only when meaningful changes occur

---

## Phase 10 — Demo

* [x] Real data demonstration
* [ ] Global search demonstration
* [ ] What-if simulation
* [ ] Live incident detection
* [ ] Five-minute monitoring
* [ ] Groq explanation
* [ ] Simulation-mode emergency
* [ ] End-to-end demo flow

---

# 25. MVP Priority

If development time is limited, prioritize:

### P0 — Must Work

```text
✓ Global location search
✓ Climate risk calculation
✓ What-if simulation
✓ IMD live data
✓ India monitoring
✓ Emergency detection
✓ Automatic incidents
✓ 5-minute monitoring
✓ Live command center
✓ Groq explanations
✓ Simulation mode
```

### P1 — Strong Enhancement

```text
○ CWC integration
○ Advanced map
○ Historical trends
○ More Indian locations
○ Better prediction models
```

### P2 — Future

```text
○ Water tanker optimization
○ Leak detection
○ Groundwater intelligence
○ Organization accounts
○ Automated resource allocation
○ Authority integration
```

---

# 26. Scope Mapping to Heat & Water Track

| Track Requirement        | ClimateOps Capability                 |
| ------------------------ | ------------------------------------- |
| **Heatwaves**            | Heat risk engine + live detection     |
| **Floods**               | Flood risk + incident monitoring      |
| **Monsoon waterlogging** | Rainfall + location risk + simulation |
| **Droughts**             | Water stress + drought risk           |
| **Water tankers**        | Future water-demand/resource module   |
| **Leaks**                | Future anomaly/leak detection module  |
| **Groundwater**          | Future groundwater monitoring module  |

The MVP focuses primarily on:

> **Heatwaves + Floods + Monsoon Waterlogging + Drought/Water Stress**

The remaining track areas become the expansion roadmap rather than forcing every feature into the hackathon MVP.

---

# 27. What NOT to Build Initially

Avoid spending hackathon time on:

```text
✗ Mobile application
✗ Kubernetes
✗ Complex microservices
✗ Custom ML before MVP
✗ Continuous GPS tracking
✗ 20+ external APIs
✗ Real emergency emails to authorities
✗ Overly complex authentication
```

Build the core loop first:

```text
REAL DATA
   ↓
RISK
   ↓
DETECTION
   ↓
INCIDENT
   ↓
5-MIN MONITORING
   ↓
LIVE UI
   ↓
AI INSIGHT
```

---

# 28. Final Product Architecture

```text
                         CLIMATEOPS
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
      🌍 CLIMATE INTELLIGENCE       🚨 INDIA EMERGENCY OPS
              │                             │
        Global Search                  India Only
              │                             │
     Environmental Data              Official Data
              │                             │
              ▼                             ▼
         Risk Engine ◄─────────────── Risk Engine
              │                             │
              ▼                             ▼
      What-if Simulation              Emergency Engine
              │                             │
              ▼                             ▼
          Groq                         Incidents
              │                             │
              │                      5-Min Monitoring
              │                             │
              └──────────────┬──────────────┘
                             │
                             ▼
                    LIVE COMMAND CENTER
                             │
                             ▼
                           React
```

---

# 29. Final Hackathon Pitch

> **ClimateOps turns climate data into decisions.**
>
> Users can explore environmental risk anywhere in the world, understand why the risk exists, and simulate how changing conditions could affect it.
>
> For India, ClimateOps continuously monitors environmental signals, detects emerging heat, flood, monsoon, drought and water-related risks, automatically creates incidents, reassesses them every five minutes, and provides AI-powered decision support through Groq.
>
> **From climate data to climate action.**
