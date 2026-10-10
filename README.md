# ClimateOps

ClimateOps is a climate intelligence and emergency response platform. It brings
location-based climate risk assessments, live monitoring for selected Indian
cities, incident response context, and scenario exploration into one interface.

The product is designed to help people explore environmental signals and
understand potential risks. It is not an official warning system and must not
replace alerts from local authorities or emergency services.

## Product overview

ClimateOps provides three main workspaces:

### Climate intelligence

Search for a place and explore its latest available environmental observations
and risk assessment for heat, flooding, water stress, and drought. The location
view can also provide an AI-generated explanation and a contextual chat about
that place when Groq is configured.

### India Emergency Command Center

Monitor a configured set of Indian cities on a map and in an incident list.
The backend runs monitoring cycles at the configured interval and the dashboard
can also request an immediate scan. Heat, flood, water-stress, and drought
incidents are detected at a risk score of **20% or higher**. Heavy-rain
incidents use an observation-based rainfall trigger. Active incidents are
published to connected clients over WebSocket or Server-Sent Events (SSE).

The **Demo preview** is separate from live monitoring: its illustrative cards
are synthetic, marked as demo, and are not persisted as live incidents.
Live scans depend on provider data; a scan can correctly return no incidents
when current observations do not meet a trigger.

### Scenario lab

Explore a location and adjust scenario inputs such as temperature, humidity,
rainfall, and river level to see modeled risk changes. Simulations are
exploratory scenarios, not forecasts or official warnings.

## How it works

1. The Next.js frontend calls the FastAPI backend for searches, risk data,
   incident information, and simulations.
2. The backend retrieves environmental observations through configured data
   adapters and calculates risk assessments.
3. The monitoring service periodically checks enabled locations and creates,
   updates, or resolves incidents based on the current observation and risk
   rules.
4. The backend broadcasts live incident and risk updates to the command center.
5. When a Groq API key is configured, AI endpoints can explain climate risk,
   suggest incident response measures, and answer follow-up questions using
   the selected location or incident context. Chat history is sent with the
   request and is not stored as a server-side conversation thread.

Risk scores are estimates generated from available observations and the
project's assessment logic. Data availability, provider coverage, and
freshness can vary by place.

## Technology

| Area | Technologies |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript |
| UI | Tailwind CSS, Framer Motion, MapLibre GL, Recharts |
| Frontend data/state | TanStack Query, Zustand |
| Backend | Python 3.11+, FastAPI, Pydantic |
| Persistence | SQLite for local development; DynamoDB for configured deployments |
| Climate data | OpenWeather adapter; optional IMD/CWC configuration |
| AI | Groq through LangChain integration |
| Testing and quality | Pytest, Ruff, Vitest, Biome, TypeScript |

## Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── api/routes/       # Climate, simulation, incidents, monitoring APIs
│   │   ├── adapters/         # Environmental data provider integrations
│   │   ├── core/             # Risk, emergency, simulation, and AI logic
│   │   ├── database/         # Models and SQLite/DynamoDB repositories
│   │   └── services/         # Location, weather, and monitoring services
│   ├── config/               # Monitored-location configuration
│   ├── tests/
│   ├── .env.example
│   └── requirements*.txt
├── frontend/
│   ├── src/app/              # Home, climate, emergency, and simulation pages
│   ├── src/components/       # Shared UI and product components
│   ├── src/lib/              # API client and helpers
│   ├── .env.example
│   └── package.json
└── README.md
```

## Getting started

Run the backend and frontend in separate terminals. For complete provider and
deployment configuration, see [backend/README.md](backend/README.md) and
[frontend/README.md](frontend/README.md).

### Requirements

- Python 3.11 or newer
- Node.js 20 or newer and npm
- An OpenWeather API key for live weather observations and monitoring
- A GeoNames username and an identifying OpenStreetMap Nominatim email
- A Groq API key for AI explanations and contextual chat (optional)

### 1. Configure and start the backend

In PowerShell:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and provide at least:

```dotenv
APP_ENV=development
APP_DEBUG=true
SECRET_KEY=replace-with-a-random-secret-of-at-least-32-characters
OPENWEATHER_API_KEY=your-openweather-api-key
GEONAMES_USERNAME=your-geonames-username
OPENSTREETMAP_NOMINATIM_EMAIL=you@example.com
GROQ_API_KEY=your-groq-api-key
```

`GROQ_API_KEY` is optional if AI features are not needed. Do not commit `.env`
files or real credentials.

Start the API from the `backend` directory:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend uses SQLite in local development. On startup, it also starts the
background monitoring service. Its interval can be changed with
`MONITORING_INTERVAL_MINUTES`; monitored cities are defined in
`backend/config/monitored_locations.json`.

### 2. Configure and start the frontend

In another PowerShell terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
```

The local defaults in `frontend/.env.local` are:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_SIMULATION_MODE=true
```

`NEXT_PUBLIC_WS_URL` is the backend base URL; do not append `/api` to it.
Start the frontend:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### macOS/Linux notes

Use `python3 -m venv .venv`, activate with `source .venv/bin/activate`, and
copy environment files with `cp .env.example .env` (or `.env.local` in the
frontend). The remaining commands are the same.

## Application routes

| Route | Description |
|---|---|
| `/` | Product landing page and location search |
| `/climate/{locationId}` | Location climate risk, AI analysis, and contextual chat |
| `/emergency` | India Emergency Command Center, live incidents, and demo preview |
| `/simulate` | Climate scenario lab |

## API overview

All application API endpoints use the `/api` prefix. Health and development
documentation are served at `/health` and `/docs`, respectively (`/docs` is
available when `APP_DEBUG=true`).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/locations/search?q={query}` | Search locations |
| `GET` | `/api/climate/{locationId}` | Get location observations and risk assessment |
| `GET` | `/api/climate/{locationId}/history` | Get observation history |
| `POST` | `/api/climate/{locationId}/explain` | Generate AI climate-risk analysis |
| `POST` | `/api/climate/{locationId}/chat` | Ask questions with location climate context |
| `POST` | `/api/climate/{locationId}/simulate` | Run a location-based scenario |
| `GET` | `/api/simulations/{simulationId}` | Retrieve a simulation |
| `GET` | `/api/incidents/active` | List persisted active incidents |
| `GET` | `/api/incidents/summary` | Get active incident summary |
| `GET` | `/api/incidents/{incidentId}` | Get incident details |
| `GET` | `/api/incidents/{incidentId}/timeline` | Get incident observation timeline |
| `POST` | `/api/incidents/{incidentId}/explain` | Generate AI incident response analysis |
| `POST` | `/api/incidents/{incidentId}/chat` | Ask questions with incident context |
| `GET` | `/api/incidents/demo-preview` | Get illustrative, non-persisted demo cards |
| `POST` | `/api/incidents/simulate` | Create an incident simulation |
| `GET` | `/api/monitoring/locations` | List configured monitored locations |
| `GET` | `/api/monitoring/status` | Get monitoring status |
| `POST` | `/api/monitoring/trigger` | Trigger an immediate monitoring scan |
| `WS` | `/api/monitoring/ws/incidents` | Subscribe to all incident updates |
| `WS` | `/api/monitoring/ws/incidents/{incidentId}` | Subscribe to one incident |
| `GET` | `/api/monitoring/sse/incidents` | Subscribe to incident updates over SSE |
| `GET` | `/api/monitoring/sse/incidents/{incidentId}` | Subscribe to one incident over SSE |

### Reverse proxies and `root_path`

The FastAPI application uses `/api` in its route definitions. In development,
the ASGI `root_path` is empty so the local server exposes those routes directly
as `/api/...`. In staging and production, `root_path` defaults to `/api` for
deployments whose proxy or API gateway mounts the application under that path.
Set `ROOT_PATH` explicitly in the backend environment to override the default.
Configure the proxy and `ROOT_PATH` together for your deployment; the
`root_path` setting describes the externally mounted prefix and does not
replace the `/api` prefixes on application routes.

## Configuration reference

The full templates are in `backend/.env.example` and `frontend/.env.example`.
Common backend settings:

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development`, `staging`, or `production` |
| `APP_DEBUG` | Enables API documentation when true |
| `SECRET_KEY` | Application secret; use a unique, securely generated value |
| `ROOT_PATH` | Optional explicit ASGI deployment prefix |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `OPENWEATHER_API_KEY` | Enables OpenWeather-backed observations |
| `GEONAMES_USERNAME` | Location search provider account |
| `OPENSTREETMAP_NOMINATIM_EMAIL` | Contact identifier for Nominatim requests |
| `GROQ_API_KEY` | Enables AI explanations and contextual chat |
| `GROQ_MODEL` | Groq model name |
| `AWS_REGION` | AWS region for DynamoDB |
| `AWS_DYNAMODB_ENDPOINT` | Optional DynamoDB-compatible endpoint |
| `MONITORING_INTERVAL_MINUTES` | Background monitoring interval (default: 5) |
| `MONITORED_LOCATIONS_CONFIG` | Path to monitored city configuration |
| `SIMULATION_MODE_ENABLED` | Enables simulation features |

Local development uses SQLite. Staging and production use DynamoDB unless the
backend is explicitly configured to use a local DynamoDB endpoint. In deployed
AWS environments, prefer an IAM role with least-privilege permissions instead
of long-lived access keys.

## Running checks

Backend, from `backend/`:

```powershell
pytest
ruff check app tests
```

Frontend, from `frontend/`:

```powershell
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

The frontend test command may report that no test files are currently present.

## Data, alerts, and responsible use

- Live incident cards are created from observations and risk calculations; the
  dashboard does not invent a live alert when current data is below a trigger.
- The current threshold for heat, flood, water stress, and drought incidents is
  20%. Heavy rain uses its own rainfall-based trigger.
- Demo-preview incidents are synthetic and intentionally separate from the
  active incident API.
- AI-generated guidance is informational and may be incomplete or incorrect.
  Confirm response decisions with local authorities and domain experts.
- Provider outages, API quotas, network access, or missing credentials can
  affect search and observation freshness.

## License and attribution

This repository's existing component READMEs reference the MIT license; confirm
the repository's license file before redistributing the project. ClimateOps
uses external data and services whose availability and terms are controlled by
their respective providers.

## Project

Built for the Environmental Hacks hackathon by WeMakeDevs.
