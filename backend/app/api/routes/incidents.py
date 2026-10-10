import re
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, ValidationError, field_validator

from app.api.chat_context import build_observation_context
from app.api.deps import (
    get_incidents_repo,
    get_location_service,
    get_monitoring_service,
    get_weather_service,
)
from app.config import settings
from app.core.groq import groq_client
from app.database import IncidentsRepository
from app.database.models import (
    Incident,
    IncidentSeverity,
    IncidentStatus,
    IncidentType,
    RiskAssessment,
)
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.incidents import (
    IncidentResponse,
    IncidentSummaryResponse,
    IncidentTimelineResponse,
)
from app.services.location_service import LocationService
from app.services.monitoring_service import MonitoringService
from app.services.weather_service import WeatherService

router = APIRouter()


class IncidentAIExplanationResponse(BaseModel):
    why_emergency: str
    key_factors: list[str]
    immediate_actions: list[str]
    monitoring_priorities: list[str]
    escalation_scenarios: list[str]

    @field_validator(
        "key_factors",
        "immediate_actions",
        "monitoring_priorities",
        "escalation_scenarios",
        mode="before",
    )
    @classmethod
    def normalize_text_lists(cls, value):
        if isinstance(value, str):
            return [
                re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip()
                for line in value.splitlines()
                if line.strip()
            ]
        return value


DEMO_SCENARIOS = (
    ("Jaipur", IncidentType.HEAT, IncidentSeverity.CRITICAL, 88),
    ("Guwahati", IncidentType.HEAVY_RAIN, IncidentSeverity.WARNING, 72),
    ("Mumbai", IncidentType.FLOOD, IncidentSeverity.WARNING, 67),
)


@router.get("/active", response_model=list[IncidentResponse])
async def get_active_incidents(
    incidents_repo: IncidentsRepository = Depends(get_incidents_repo),
):
    incidents = await incidents_repo.get_active()
    return [IncidentResponse(**inc) for inc in incidents]


@router.get("/demo-preview", response_model=list[IncidentResponse])
async def get_demo_incidents(
    location_service: LocationService = Depends(get_location_service),
):
    """Return illustrative, non-persistent scenarios separate from live incidents."""
    locations = await location_service.get_monitored_locations()
    if not locations:
        return []

    locations_by_name = {
        name.casefold(): location
        for location in locations
        for name in (location.city, location.district, location.state)
        if name
    }
    now = datetime.now(UTC)
    incidents = []

    for index, (place_name, incident_type, severity, risk_score) in enumerate(DEMO_SCENARIOS):
        location = locations_by_name.get(place_name.casefold())
        if location is None:
            location = locations[min(index, len(locations) - 1)]

        updated_at = now - timedelta(minutes=(index + 1) * 7)
        status = (
            IncidentStatus.CRITICAL
            if severity == IncidentSeverity.CRITICAL
            else IncidentStatus.WARNING
        )
        incidents.append(
            IncidentResponse(
                incidentId=f"DEMO-{incident_type.value}-{location.locationId}",
                locationId=location.locationId,
                type=incident_type,
                severity=severity,
                status=status,
                riskScore=risk_score,
                source="DEMO SCENARIO — simulated, not a live alert",
                createdAt=updated_at,
                lastUpdated=updated_at,
                lastChecked=updated_at,
                nextCheck=now + timedelta(minutes=5),
            )
        )

    return incidents


@router.get("/summary", response_model=IncidentSummaryResponse)
async def get_incidents_summary(
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    summary = await monitoring_service.get_active_incidents_summary()
    return IncidentSummaryResponse(**summary)


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str = Path(..., description="Incident ID"),
    incidents_repo: IncidentsRepository = Depends(get_incidents_repo),
):
    incident = await incidents_repo.get_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentResponse(**incident)


@router.post("/{incident_id}/explain", response_model=IncidentAIExplanationResponse)
async def explain_incident(
    incident_id: str = Path(..., description="Incident ID"),
    incidents_repo: IncidentsRepository = Depends(get_incidents_repo),
    location_service: LocationService = Depends(get_location_service),
    weather_service: WeatherService = Depends(get_weather_service),
):
    incident_data = await incidents_repo.get_by_id(incident_id)
    if not incident_data:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI incident analysis is not configured on the backend.",
        )

    incident = Incident(**incident_data)
    location = await location_service.get_location(incident.locationId)
    if not location:
        raise HTTPException(status_code=404, detail="Incident location not found")

    assessment_data = await weather_service.get_latest_risk_assessment(incident.locationId)
    if not assessment_data:
        raise HTTPException(
            status_code=503,
            detail="A current climate risk assessment is not available for this incident.",
        )

    assessment = RiskAssessment(**assessment_data)
    location_name = ", ".join(
        value
        for value in (location.city, location.district, location.state, location.country)
        if value
    )
    try:
        explanation = await groq_client.explain_incident(
            incident,
            assessment,
            location_name or incident.locationId,
        )
        return IncidentAIExplanationResponse.model_validate(explanation)
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an invalid incident analysis.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI incident analysis is temporarily unavailable.",
        ) from exc


@router.post("/{incident_id}/chat", response_model=ChatResponse)
async def chat_about_incident(
    request: ChatRequest,
    incident_id: str = Path(..., description="Incident ID"),
    incidents_repo: IncidentsRepository = Depends(get_incidents_repo),
    location_service: LocationService = Depends(get_location_service),
    weather_service: WeatherService = Depends(get_weather_service),
):
    incident_data = await incidents_repo.get_by_id(incident_id)
    if not incident_data:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Incident chat is not configured on the backend.",
        )

    incident = Incident(**incident_data)
    location = await location_service.get_location(incident.locationId)
    if not location:
        raise HTTPException(status_code=404, detail="Incident location not found")

    assessment_data = await weather_service.get_latest_risk_assessment(incident.locationId)
    if not assessment_data:
        raise HTTPException(
            status_code=503,
            detail="A current climate risk assessment is not available for this incident.",
        )

    observation = await weather_service.get_latest_observation(incident.locationId)
    location_name = ", ".join(
        value
        for value in (location.city, location.district, location.state, location.country)
        if value
    )
    context = {
        "location": {
            "id": location.locationId,
            "name": location_name or incident.locationId,
            "latitude": location.latitude,
            "longitude": location.longitude,
        },
        "incident": {
            "id": incident.incidentId,
            "type": incident.type.value,
            "severity": incident.severity.value,
            "status": incident.status.value,
            "risk_score": incident.riskScore,
            "source": incident.source,
            "created_at": incident.createdAt.isoformat(),
            "last_updated": incident.lastUpdated.isoformat(),
        },
        "risk_assessment": RiskAssessment(**assessment_data).model_dump(mode="json"),
        "latest_observation": build_observation_context(observation),
    }

    try:
        reply = await groq_client.chat(
            context,
            [message.model_dump() for message in request.messages],
        )
        return ChatResponse(reply=reply)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Incident chat is temporarily unavailable.",
        ) from exc


@router.get("/{incident_id}/timeline", response_model=IncidentTimelineResponse)
async def get_incident_timeline(
    incident_id: str = Path(..., description="Incident ID"),
    monitoring_service: MonitoringService = Depends(get_monitoring_service),
):
    incident = await monitoring_service.incidents_repo.get_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    timeline = await monitoring_service.get_incident_timeline(incident_id)
    return IncidentTimelineResponse(
        incidentId=incident_id,
        incident=IncidentResponse(**incident),
        timeline=[obs for obs in timeline],
    )


@router.post("/simulate")
async def simulate_incident(
    location_id: str = Query(..., description="Location ID"),
    incident_type: IncidentType = Query(..., description="Incident type to simulate"),
    severity: IncidentSeverity = Query(IncidentSeverity.WARNING, description="Incident severity"),
    weather_service: WeatherService = Depends(get_weather_service),
    location_service: LocationService = Depends(get_location_service),
):
    location = await location_service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    observation = await weather_service.get_latest_observation(location_id)
    if not observation:
        await weather_service.fetch_and_store_current(location_id, location.latitude, location.longitude)
        observation = await weather_service.get_latest_observation(location_id)

    if not observation:
        raise HTTPException(status_code=503, detail="Unable to fetch environmental data")

    from app.core.emergency_engine import DetectionResult, create_incident

    detection = DetectionResult(
        should_create_incident=True,
        incident_type=incident_type,
        severity=severity,
        risk_score=75,
        reasons=[f"Simulated {incident_type.value} incident"],
    )

    from app.core import assess_all_risks
    risk_assessment = assess_all_risks(observation)
    incident = create_incident(detection, risk_assessment, observation)
    status_by_severity = {
        IncidentSeverity.WARNING: IncidentStatus.WARNING,
        IncidentSeverity.CRITICAL: IncidentStatus.CRITICAL,
        IncidentSeverity.EXTREME: IncidentStatus.EXTREME,
    }
    incident.status = status_by_severity[severity]

    return {
        "simulation": True,
        "incident": incident.model_dump(mode="json"),
        "message": f"Simulated {incident_type.value} incident for {location.city or location.district}",
    }
