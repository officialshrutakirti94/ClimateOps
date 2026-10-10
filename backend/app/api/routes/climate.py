import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, ValidationError, field_validator

from app.api.chat_context import build_observation_context
from app.api.deps import get_location_service, get_weather_service
from app.config import settings
from app.core.groq import groq_client
from app.database.models import RiskAssessment
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.climate import ClimateRiskResponse, LocationSearchResult
from app.services.location_service import LocationService
from app.services.weather_service import WeatherService

router = APIRouter()


class ClimateAIExplanation(BaseModel):
    summary: str
    key_factors: list[str]
    recommendations: list[str]
    potential_impacts: list[str]

    @field_validator("key_factors", "recommendations", "potential_impacts", mode="before")
    @classmethod
    def normalize_text_lists(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [
                re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip()
                for line in value.splitlines()
                if line.strip()
            ]
        return value


class LocationSearchQuery(BaseModel):
    q: str = Query(..., min_length=1, description="Location search query")
    limit: int = Query(10, ge=1, le=50)


@router.get("/locations/search", response_model=list[LocationSearchResult])
async def search_locations(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    location_service: LocationService = Depends(get_location_service),
):
    results = await location_service.search_locations(q, limit)
    return results


@router.get("/climate/{location_id}", response_model=ClimateRiskResponse)
async def get_climate_risk(
    location_id: str = Path(..., description="Location ID"),
    weather_service: WeatherService = Depends(get_weather_service),
    location_service: LocationService = Depends(get_location_service),
):
    location = await location_service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    observation = await weather_service.get_latest_observation(location_id)
    if not observation:
        await weather_service.fetch_and_store_current(
            location_id, location.latitude, location.longitude
        )
        observation = await weather_service.get_latest_observation(location_id)

    if not observation:
        raise HTTPException(status_code=503, detail="Unable to fetch environmental data")

    risk_assessment = await weather_service.get_latest_risk_assessment(location_id)
    if not risk_assessment:
        raise HTTPException(status_code=503, detail="Risk assessment not available")

    return ClimateRiskResponse(
        location=location,
        observation=observation,
        risk=RiskAssessment(**risk_assessment),
    )


@router.post("/climate/{location_id}/explain", response_model=ClimateAIExplanation)
async def explain_climate_risk(
    location_id: str = Path(..., description="Location ID"),
    weather_service: WeatherService = Depends(get_weather_service),
    location_service: LocationService = Depends(get_location_service),
):
    location = await location_service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI climate analysis is not configured on the backend.",
        )

    assessment_data = await weather_service.get_latest_risk_assessment(location_id)
    if not assessment_data:
        raise HTTPException(
            status_code=503,
            detail="A current climate risk assessment is not available for this location.",
        )

    assessment = RiskAssessment(**assessment_data)
    location_name = ", ".join(
        value
        for value in (location.city, location.district, location.state, location.country)
        if value
    )

    try:
        explanation: Any = await groq_client.explain_climate_risk(
            assessment,
            location_name or location_id,
        )
        return ClimateAIExplanation.model_validate(explanation)
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an invalid climate analysis.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI climate analysis is temporarily unavailable.",
        ) from exc


@router.post("/climate/{location_id}/chat", response_model=ChatResponse)
async def chat_about_climate(
    request: ChatRequest,
    location_id: str = Path(..., description="Location ID"),
    weather_service: WeatherService = Depends(get_weather_service),
    location_service: LocationService = Depends(get_location_service),
):
    location = await location_service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Climate chat is not configured on the backend.",
        )

    observation = await weather_service.get_latest_observation(location_id)
    if not observation:
        await weather_service.fetch_and_store_current(
            location_id, location.latitude, location.longitude
        )
        observation = await weather_service.get_latest_observation(location_id)

    assessment_data = await weather_service.get_latest_risk_assessment(location_id)
    if not assessment_data:
        raise HTTPException(
            status_code=503,
            detail="A current climate risk assessment is not available for this location.",
        )

    location_name = ", ".join(
        value
        for value in (location.city, location.district, location.state, location.country)
        if value
    )
    context = {
        "location": {
            "id": location.locationId,
            "name": location_name or location_id,
            "latitude": location.latitude,
            "longitude": location.longitude,
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
            detail="Climate chat is temporarily unavailable.",
        ) from exc


@router.get("/climate/{location_id}/history")
async def get_climate_history(
    location_id: str = Path(..., description="Location ID"),
    hours: int = Query(24, ge=1, le=168),
    weather_service: WeatherService = Depends(get_weather_service),
    location_service: LocationService = Depends(get_location_service),
):
    location = await location_service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    history = await weather_service.get_observation_history(location_id, hours)
    return {
        "locationId": location_id,
        "hours": hours,
        "observations": [obs.model_dump() for obs in history],
    }
