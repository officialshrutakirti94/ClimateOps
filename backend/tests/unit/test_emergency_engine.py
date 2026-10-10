from datetime import datetime

import pytest

from app.core.emergency_engine import (
    EmergencyThresholds,
    check_incident_resolution,
    create_incident,
    resolve_incident,
    run_emergency_detection,
    update_incident,
)
from app.core.risk_engine import RiskThresholds, assess_all_risks
from app.database.models import (
    AlertData,
    EnvironmentalObservation,
    Incident,
    IncidentSeverity,
    IncidentStatus,
    IncidentType,
    RiskAssessment,
    RiskLevel,
    WaterData,
    WeatherData,
)


@pytest.fixture
def heat_emergency_observation():
    return EnvironmentalObservation(
        locationId="TEST-HEAT",
        timestamp=datetime.utcnow(),
        weather=WeatherData(temperature=42.0, humidity=80, rainfall=0, windSpeed=10, pressure=1005),
        water=None,
        alerts=[],
        source="test",
    )


@pytest.fixture
def flood_emergency_observation():
    return EnvironmentalObservation(
        locationId="TEST-FLOOD",
        timestamp=datetime.utcnow(),
        weather=WeatherData(temperature=28.0, humidity=90, rainfall=120, windSpeed=15, pressure=995),
        water=WaterData(riverLevel=45.0, riverLevelTrend="RISING"),
        alerts=[AlertData(type="FLOOD", severity="SEVERE", description="Flood warning", issuedAt=datetime.utcnow())],
        source="test",
    )


@pytest.fixture
def heat_risk_assessment(heat_emergency_observation):
    return assess_all_risks(heat_emergency_observation)


@pytest.fixture
def flood_risk_assessment(flood_emergency_observation):
    return assess_all_risks(flood_emergency_observation)


def test_detect_heat_emergency(heat_risk_assessment, heat_emergency_observation):
    existing = []
    detections = run_emergency_detection(heat_risk_assessment, heat_emergency_observation, existing)
    heat_detections = [detection for detection in detections if detection.incident_type == IncidentType.HEAT]
    assert len(heat_detections) == 1
    assert heat_detections[0].should_create_incident is True
    expected_severity = (
        IncidentSeverity.CRITICAL
        if heat_detections[0].risk_score >= 90
        else IncidentSeverity.WARNING
    )
    assert heat_detections[0].severity == expected_severity
    assert heat_detections[0].risk_score >= 30


def test_detect_flood_emergency(flood_risk_assessment, flood_emergency_observation):
    existing = []
    detections = run_emergency_detection(flood_risk_assessment, flood_emergency_observation, existing)
    flood_detections = [d for d in detections if d.incident_type == IncidentType.FLOOD]
    assert len(flood_detections) == 1
    assert flood_detections[0].should_create_incident is True
    assert flood_detections[0].incident_type == IncidentType.FLOOD


def test_no_emergency_low_risk():
    obs = EnvironmentalObservation(
        locationId="TEST-SAFE",
        timestamp=datetime.utcnow(),
        weather=WeatherData(temperature=25.0, humidity=50, rainfall=25, windSpeed=5, pressure=1010),
        water=WaterData(riverLevel=20.0, riverLevelTrend="STABLE"),
        alerts=[],
        source="test",
    )
    assessment = assess_all_risks(obs)
    detections = run_emergency_detection(assessment, obs, [])
    assert len(detections) == 0


@pytest.mark.parametrize(
    ("risk_field", "incident_type"),
    [
        ("heatRisk", IncidentType.HEAT),
        ("floodRisk", IncidentType.FLOOD),
        ("waterStressRisk", IncidentType.WATER_STRESS),
        ("droughtRisk", IncidentType.DROUGHT),
    ],
)
def test_percentage_risk_at_threshold_creates_incident_without_extra_confirmation(
    risk_field, incident_type
):
    observation = EnvironmentalObservation(
        locationId="TEST-WATCH",
        timestamp=datetime.utcnow(),
        weather=WeatherData(temperature=20.0, humidity=50, rainfall=0, windSpeed=5, pressure=1010),
        water=None,
        alerts=[],
        source="test",
    )
    risk_values = {
        "locationId": "TEST-WATCH",
        "timestamp": datetime.utcnow(),
        "heatRisk": 0,
        "floodRisk": 0,
        "waterStressRisk": 0,
        "droughtRisk": 0,
        "heatSeverity": RiskLevel.LOW,
        "floodSeverity": RiskLevel.LOW,
        "waterStressSeverity": RiskLevel.LOW,
        "droughtSeverity": RiskLevel.LOW,
    }
    risk_values[risk_field] = 20
    assessment = RiskAssessment(**risk_values)

    detections = run_emergency_detection(assessment, observation, [])

    assert [detection.incident_type for detection in detections] == [incident_type]
    assert detections[0].should_create_incident is True
    assert detections[0].severity == IncidentSeverity.WARNING
    assert detections[0].risk_score == 20

    risk_values[risk_field] = 19
    assert run_emergency_detection(RiskAssessment(**risk_values), observation, []) == []


@pytest.mark.parametrize(
    ("incident_type", "risk_field"),
    [
        (IncidentType.HEAT, "heatRisk"),
        (IncidentType.FLOOD, "floodRisk"),
        (IncidentType.WATER_STRESS, "waterStressRisk"),
        (IncidentType.DROUGHT, "droughtRisk"),
    ],
)
def test_percentage_risk_incident_remains_active_at_20_and_resolves_below(
    incident_type, risk_field
):
    from app.core.emergency_engine import check_incident_resolution

    incident = Incident(
        incidentId="INC-WATCH",
        locationId="TEST-WATCH",
        type=incident_type,
        severity=IncidentSeverity.WARNING,
        status=IncidentStatus.WARNING,
        riskScore=25,
        source="test",
        createdAt=datetime.utcnow(),
        lastUpdated=datetime.utcnow(),
    )
    risk_values = {
        "locationId": "TEST-WATCH",
        "timestamp": datetime.utcnow(),
        "heatRisk": 0,
        "floodRisk": 0,
        "waterStressRisk": 0,
        "droughtRisk": 0,
        "heatSeverity": RiskLevel.LOW,
        "floodSeverity": RiskLevel.LOW,
        "waterStressSeverity": RiskLevel.LOW,
        "droughtSeverity": RiskLevel.LOW,
    }
    risk_values[risk_field] = 25
    assert check_incident_resolution(incident, RiskAssessment(**risk_values)) is False

    risk_values[risk_field] = 19
    assert check_incident_resolution(incident, RiskAssessment(**risk_values)) is True


def test_create_incident(heat_risk_assessment, heat_emergency_observation):
    from app.core.emergency_engine import DetectionResult
    detection = DetectionResult(
        should_create_incident=True,
        incident_type=IncidentType.HEAT,
        severity=IncidentSeverity.CRITICAL,
        risk_score=85,
        reasons=["High heat risk", "Temperature 42°C"],
    )
    incident = create_incident(detection, heat_risk_assessment, heat_emergency_observation)
    assert incident.incidentId.startswith("INC-")
    assert incident.locationId == "TEST-HEAT"
    assert incident.type == IncidentType.HEAT
    assert incident.severity == IncidentSeverity.CRITICAL
    assert incident.status == IncidentStatus.CRITICAL
    assert incident.riskScore == 85


def test_update_incident_increases_severity():
    incident = Incident(
        incidentId="INC-TEST001",
        locationId="TEST",
        type=IncidentType.FLOOD,
        severity=IncidentSeverity.WARNING,
        status=IncidentStatus.WARNING,
        riskScore=70,
        source="test",
        createdAt=datetime.utcnow(),
        lastUpdated=datetime.utcnow(),
    )

    from app.core.emergency_engine import DetectionResult
    detection = DetectionResult(
        should_create_incident=True,
        incident_type=IncidentType.FLOOD,
        severity=IncidentSeverity.CRITICAL,
        risk_score=90,
        reasons=["Risk increased"],
    )

    obs = EnvironmentalObservation(
        locationId="TEST",
        timestamp=datetime.utcnow(),
        weather=WeatherData(temperature=28, humidity=90, rainfall=150, windSpeed=15, pressure=995),
        water=WaterData(riverLevel=48, riverLevelTrend="RISING"),
        alerts=[],
        source="test",
    )

    assessment = assess_all_risks(obs)
    updated = update_incident(incident, detection, assessment, obs)

    assert updated.severity == IncidentSeverity.CRITICAL
    assert updated.status == IncidentStatus.CRITICAL
    assert updated.riskScore == 90


def test_check_incident_resolution():
    incident = Incident(
        incidentId="INC-TEST002",
        locationId="TEST",
        type=IncidentType.HEAT,
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.CRITICAL,
        riskScore=85,
        source="test",
        createdAt=datetime.utcnow(),
        lastUpdated=datetime.utcnow(),
    )

    low_risk_assessment = RiskAssessment(
        locationId="TEST",
        timestamp=datetime.utcnow(),
        heatRisk=20,
        floodRisk=10,
        waterStressRisk=15,
        droughtRisk=10,
        heatSeverity=RiskLevel.LOW,
        floodSeverity=RiskLevel.LOW,
        waterStressSeverity=RiskLevel.LOW,
        droughtSeverity=RiskLevel.LOW,
    )

    assert check_incident_resolution(incident, low_risk_assessment) is False

    low_risk_assessment.heatRisk = 19
    assert check_incident_resolution(incident, low_risk_assessment) is True

    resolved = resolve_incident(incident)
    assert resolved.status == IncidentStatus.RESOLVED
    assert resolved.nextCheck is None


def test_flood_resolution_threshold():
    incident = Incident(
        incidentId="INC-TEST003",
        locationId="TEST",
        type=IncidentType.FLOOD,
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.CRITICAL,
        riskScore=85,
        source="test",
        createdAt=datetime.utcnow(),
        lastUpdated=datetime.utcnow(),
    )

    assessment = RiskAssessment(
        locationId="TEST",
        timestamp=datetime.utcnow(),
        heatRisk=10,
        floodRisk=25,
        waterStressRisk=15,
        droughtRisk=10,
        heatSeverity=RiskLevel.LOW,
        floodSeverity=RiskLevel.LOW,
        waterStressSeverity=RiskLevel.LOW,
        droughtSeverity=RiskLevel.LOW,
    )

    assert check_incident_resolution(incident, assessment) is False

    assessment.floodRisk = 19
    assert check_incident_resolution(incident, assessment) is True