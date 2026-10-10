from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import (
    get_incidents_repo as incidents_repo_dependency,
)
from app.api.deps import (
    get_location_service as location_service_dependency,
)
from app.api.deps import (
    get_simulations_repo as simulations_repo_dependency,
)
from app.api.deps import (
    get_weather_service as weather_service_dependency,
)
from app.core.groq import groq_client
from app.database.models import (
    EnvironmentalObservation,
    Incident,
    IncidentSeverity,
    IncidentStatus,
    IncidentType,
    Location,
    RiskAssessment,
    RiskLevel,
    WeatherData,
)
from app.main import app


@pytest.fixture
async def async_client():
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def mock_location():
    return Location(
        locationId="TEST-001",
        country="India",
        state="Test State",
        district="Test District",
        city="Test City",
        latitude=28.6,
        longitude=77.2,
        monitoringEnabled=False,
        riskTypes=[],
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow(),
    )


@pytest.fixture
def mock_observation():
    return EnvironmentalObservation(
        locationId="TEST-001",
        timestamp=datetime.utcnow(),
        weather=WeatherData(temperature=30.0, humidity=60, rainfall=5.0, windSpeed=10.0, pressure=1010.0),
        water=None,
        alerts=[],
        source="test",
    )


@pytest.fixture
def mock_risk_assessment():
    return RiskAssessment(
        locationId="TEST-001",
        timestamp=datetime.utcnow(),
        heatRisk=45,
        floodRisk=20,
        waterStressRisk=30,
        droughtRisk=15,
        heatSeverity=RiskLevel.MEDIUM,
        floodSeverity=RiskLevel.LOW,
        waterStressSeverity=RiskLevel.LOW,
        droughtSeverity=RiskLevel.LOW,
        contributingFactors={},
        dataSources=["test"],
    )


class TestClimateAPI:
    def test_climate_ai_prompt_includes_all_risk_fields(self, mock_risk_assessment):
        prompt = groq_client._build_climate_prompt(mock_risk_assessment, "Test City")

        assert "Heat: 45% (MEDIUM)" in prompt
        assert "Flood: 20% (LOW)" in prompt
        assert "Water Stress: 30% (LOW)" in prompt
        assert "Drought: 15% (LOW)" in prompt
        assert "No specific factors reported" in prompt

    @pytest.mark.asyncio
    async def test_health_check(self, async_client):
        response = await async_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "climatify-backend"

    @pytest.mark.asyncio
    async def test_root_endpoint(self, async_client):
        response = await async_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "ClimateOps API"

    @pytest.mark.asyncio
    async def test_search_locations(self, async_client, mock_location):
        with patch("app.api.deps.get_location_service") as mock_service:
            mock_svc = AsyncMock()
            mock_svc.search_locations.return_value = [mock_location.model_dump()]
            mock_service.return_value = mock_svc
            app.dependency_overrides[location_service_dependency] = lambda: mock_svc

            response = await async_client.get("/api/locations/search?q=delhi")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["city"] == "Test City"

    @pytest.mark.asyncio
    async def test_get_climate_risk(self, async_client, mock_location, mock_observation, mock_risk_assessment):
        with patch("app.api.deps.get_location_service") as mock_loc_service, \
             patch("app.api.deps.get_weather_service") as mock_weather_service:

            mock_loc = AsyncMock()
            mock_loc.get_location.return_value = mock_location
            mock_loc_service.return_value = mock_loc
            app.dependency_overrides[location_service_dependency] = lambda: mock_loc

            mock_weather = AsyncMock()
            mock_weather.get_latest_observation.return_value = mock_observation
            mock_weather.get_latest_risk_assessment.return_value = mock_risk_assessment.model_dump()
            mock_weather_service.return_value = mock_weather
            app.dependency_overrides[weather_service_dependency] = lambda: mock_weather

            response = await async_client.get("/api/climate/TEST-001")
            assert response.status_code == 200
            data = response.json()
            assert data["location"]["locationId"] == "TEST-001"
            assert data["risk"]["heatRisk"] == 45
            assert data["risk"]["heatSeverity"] == "MEDIUM"

    @pytest.mark.asyncio
    async def test_explain_climate_risk_calls_ai_with_current_risk(
        self,
        async_client,
        mock_location,
        mock_risk_assessment,
        monkeypatch,
    ):
        from app.config import settings

        location_service = AsyncMock()
        location_service.get_location.return_value = mock_location
        weather_service = AsyncMock()
        weather_service.get_latest_risk_assessment.return_value = (
            mock_risk_assessment.model_dump(mode="json")
        )
        app.dependency_overrides[location_service_dependency] = lambda: location_service
        app.dependency_overrides[weather_service_dependency] = lambda: weather_service
        monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")

        with patch(
            "app.api.routes.climate.groq_client.explain_climate_risk",
            new_callable=AsyncMock,
            return_value={
                "summary": "Heat risk is moderate for this location.",
                "key_factors": "Warm temperatures",
                "recommendations": ["Monitor heat advisories"],
                "potential_impacts": "Increased heat exposure",
            },
        ) as explain:
            response = await async_client.post("/api/climate/TEST-001/explain")

        assert response.status_code == 200
        assert response.json()["key_factors"] == ["Warm temperatures"]
        assert response.json()["potential_impacts"] == ["Increased heat exposure"]
        assert response.json()["recommendations"] == ["Monitor heat advisories"]
        explain.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_climate_chat_uses_live_location_context_and_temporary_history(
        self,
        async_client,
        mock_location,
        mock_observation,
        mock_risk_assessment,
        monkeypatch,
    ):
        from app.config import settings

        location_service = AsyncMock()
        location_service.get_location.return_value = mock_location
        weather_service = AsyncMock()
        weather_service.get_latest_observation.return_value = mock_observation
        weather_service.get_latest_risk_assessment.return_value = (
            mock_risk_assessment.model_dump(mode="json")
        )
        app.dependency_overrides[location_service_dependency] = lambda: location_service
        app.dependency_overrides[weather_service_dependency] = lambda: weather_service
        monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
        messages = [
            {"role": "user", "content": "What is the heat risk?"},
            {"role": "assistant", "content": "It is 45%."},
            {"role": "user", "content": "What does that mean for residents?"},
        ]

        with patch(
            "app.api.routes.climate.groq_client.chat",
            new_callable=AsyncMock,
            return_value="Stay hydrated and follow local heat advisories.",
        ) as chat:
            response = await async_client.post(
                "/api/climate/TEST-001/chat",
                json={"messages": messages},
            )

        assert response.status_code == 200
        assert response.json()["reply"] == "Stay hydrated and follow local heat advisories."
        context, sent_messages = chat.await_args.args
        assert context["location"]["name"] == "Test City, Test District, Test State, India"
        assert context["risk_assessment"]["heatRisk"] == 45
        assert context["latest_observation"]["weather"]["temperature"] == 30.0
        assert sent_messages == messages

    @pytest.mark.asyncio
    async def test_explain_incident_returns_prioritized_actions(
        self,
        async_client,
        mock_location,
        mock_risk_assessment,
        monkeypatch,
    ):
        from app.config import settings

        incident = Incident(
            incidentId="INC-TEST001",
            locationId="TEST-001",
            type=IncidentType.DROUGHT,
            severity=IncidentSeverity.WARNING,
            status=IncidentStatus.WARNING,
            riskScore=35,
            source="openweather",
            createdAt=datetime.utcnow(),
            lastUpdated=datetime.utcnow(),
        )
        incidents_repo = AsyncMock()
        incidents_repo.get_by_id.return_value = incident.model_dump(mode="json")
        location_service = AsyncMock()
        location_service.get_location.return_value = mock_location
        weather_service = AsyncMock()
        weather_service.get_latest_risk_assessment.return_value = (
            mock_risk_assessment.model_dump(mode="json")
        )
        app.dependency_overrides[incidents_repo_dependency] = lambda: incidents_repo
        app.dependency_overrides[location_service_dependency] = lambda: location_service
        app.dependency_overrides[weather_service_dependency] = lambda: weather_service
        monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")

        with patch(
            "app.api.routes.incidents.groq_client.explain_incident",
            new_callable=AsyncMock,
            return_value={
                "why_emergency": "Drought risk is above the watch threshold.",
                "key_factors": "Low rainfall",
                "immediate_actions": "1. Check local water restrictions\n2. Reduce non-essential use",
                "monitoring_priorities": ["Rainfall and reservoir levels"],
                "escalation_scenarios": "Risk increases if dry conditions persist",
            },
        ) as explain:
            response = await async_client.post("/api/incidents/INC-TEST001/explain")

        assert response.status_code == 200
        result = response.json()
        assert result["immediate_actions"] == [
            "Check local water restrictions",
            "Reduce non-essential use",
        ]
        assert result["monitoring_priorities"] == ["Rainfall and reservoir levels"]
        assert result["escalation_scenarios"] == [
            "Risk increases if dry conditions persist"
        ]
        explain.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_incident_chat_includes_incident_and_current_weather_context(
        self,
        async_client,
        mock_location,
        mock_observation,
        mock_risk_assessment,
        monkeypatch,
    ):
        from app.config import settings

        incident = Incident(
            incidentId="INC-CHAT001",
            locationId="TEST-001",
            type=IncidentType.DROUGHT,
            severity=IncidentSeverity.WARNING,
            status=IncidentStatus.WARNING,
            riskScore=35,
            source="openweather",
            createdAt=datetime.utcnow(),
            lastUpdated=datetime.utcnow(),
        )
        incidents_repo = AsyncMock()
        incidents_repo.get_by_id.return_value = incident.model_dump(mode="json")
        location_service = AsyncMock()
        location_service.get_location.return_value = mock_location
        weather_service = AsyncMock()
        weather_service.get_latest_observation.return_value = mock_observation
        weather_service.get_latest_risk_assessment.return_value = (
            mock_risk_assessment.model_dump(mode="json")
        )
        app.dependency_overrides[incidents_repo_dependency] = lambda: incidents_repo
        app.dependency_overrides[location_service_dependency] = lambda: location_service
        app.dependency_overrides[weather_service_dependency] = lambda: weather_service
        monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
        messages = [{"role": "user", "content": "What should I monitor next?"}]

        with patch(
            "app.api.routes.incidents.groq_client.chat",
            new_callable=AsyncMock,
            return_value="Monitor rainfall and local water notices.",
        ) as chat:
            response = await async_client.post(
                "/api/incidents/INC-CHAT001/chat",
                json={"messages": messages},
            )

        assert response.status_code == 200
        assert response.json()["reply"] == "Monitor rainfall and local water notices."
        context, sent_messages = chat.await_args.args
        assert context["incident"]["type"] == "DROUGHT"
        assert context["incident"]["risk_score"] == 35
        assert context["risk_assessment"]["heatRisk"] == 45
        assert context["latest_observation"]["weather"]["temperature"] == 30.0
        assert sent_messages == messages

    @pytest.mark.asyncio
    async def test_get_climate_risk_not_found(self, async_client):
        with patch("app.api.deps.get_location_service") as mock_loc_service:
            mock_loc = AsyncMock()
            mock_loc.get_location.return_value = None
            mock_loc_service.return_value = mock_loc
            app.dependency_overrides[location_service_dependency] = lambda: mock_loc

            response = await async_client.get("/api/climate/NONEXISTENT")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_simulate_climate(self, async_client, mock_location, mock_observation):
        with patch("app.api.deps.get_location_service") as mock_loc_service, \
             patch("app.api.deps.get_weather_service") as mock_weather_service, \
             patch("app.api.deps.get_simulations_repo") as mock_sim_repo, \
             patch("app.core.groq.groq_client.explain_simulation", new_callable=AsyncMock) as mock_groq:

            mock_loc = AsyncMock()
            mock_loc.get_location.return_value = mock_location
            mock_loc_service.return_value = mock_loc
            app.dependency_overrides[location_service_dependency] = lambda: mock_loc

            mock_weather = AsyncMock()
            mock_weather.get_latest_observation.return_value = mock_observation
            mock_weather_service.return_value = mock_weather
            app.dependency_overrides[weather_service_dependency] = lambda: mock_weather

            mock_repo = AsyncMock()
            mock_repo.save = AsyncMock()
            mock_sim_repo.return_value = mock_repo
            app.dependency_overrides[simulations_repo_dependency] = lambda: mock_repo

            mock_groq.return_value = {"summary": "Test explanation"}

            response = await async_client.post(
                "/api/climate/TEST-001/simulate",
                json={"temperature_change": 3.0, "rainfall_change_pct": -20}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["simulationId"].startswith("SIM-")
            assert data["scenario"]["temperature_change"] == 3.0
            assert "comparison" in data
            assert "summary" in data
