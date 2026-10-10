import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional

from app.core.risk_engine import RiskAssessment, RiskLevel
from app.database.models import (
    EnvironmentalObservation,
    Incident,
    IncidentSeverity,
    IncidentStatus,
    IncidentType,
)


@dataclass
class EmergencyThresholds:
    heat_risk_minimum: int = 20
    flood_risk_minimum: int = 20
    water_stress_risk_minimum: int = 20
    drought_risk_minimum: int = 20


DEFAULT_EMERGENCY_THRESHOLDS = EmergencyThresholds()


@dataclass
class DetectionResult:
    should_create_incident: bool
    incident_type: Optional[IncidentType] = None
    severity: Optional[IncidentSeverity] = None
    risk_score: int = 0
    reasons: List[str] = None
    existing_incident_id: Optional[str] = None

    def __post_init__(self):
        if self.reasons is None:
            self.reasons = []


def detect_heat_emergency(
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
    existing_incidents: List[Incident],
    thresholds: EmergencyThresholds = DEFAULT_EMERGENCY_THRESHOLDS,
) -> DetectionResult:
    existing_heat = next(
        (inc for inc in existing_incidents if inc.type == IncidentType.HEAT and inc.status != IncidentStatus.RESOLVED),
        None,
    )

    if assessment.heatRisk >= thresholds.heat_risk_minimum:
        reasons = [
            f"Heat risk at {assessment.heatRisk}% (incident threshold: {thresholds.heat_risk_minimum}%)",
        ]
        reasons.extend(assessment.contributingFactors.get("heat", []))

        severity = IncidentSeverity.CRITICAL if assessment.heatRisk >= 90 else IncidentSeverity.WARNING

        return DetectionResult(
            should_create_incident=True,
            incident_type=IncidentType.HEAT,
            severity=severity,
            risk_score=assessment.heatRisk,
            reasons=reasons,
            existing_incident_id=existing_heat.incidentId if existing_heat else None,
        )

    return DetectionResult(should_create_incident=False)


def detect_flood_emergency(
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
    existing_incidents: List[Incident],
    thresholds: EmergencyThresholds = DEFAULT_EMERGENCY_THRESHOLDS,
) -> DetectionResult:
    existing_flood = next(
        (inc for inc in existing_incidents if inc.type == IncidentType.FLOOD and inc.status != IncidentStatus.RESOLVED),
        None,
    )

    has_official_warning = any("flood" in a.type.lower() for a in obs.alerts)

    if assessment.floodRisk >= thresholds.flood_risk_minimum:
        reasons = [
            f"Flood risk at {assessment.floodRisk}% (incident threshold: {thresholds.flood_risk_minimum}%)",
        ]
        if has_official_warning:
            reasons.append("Official flood warning detected")
        reasons.extend(assessment.contributingFactors.get("flood", []))

        severity = IncidentSeverity.CRITICAL if assessment.floodRisk >= 90 else IncidentSeverity.WARNING

        return DetectionResult(
            should_create_incident=True,
            incident_type=IncidentType.FLOOD,
            severity=severity,
            risk_score=assessment.floodRisk,
            reasons=reasons,
            existing_incident_id=existing_flood.incidentId if existing_flood else None,
        )

    return DetectionResult(should_create_incident=False)


def detect_heavy_rain_emergency(
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
    existing_incidents: List[Incident],
    thresholds: EmergencyThresholds = DEFAULT_EMERGENCY_THRESHOLDS,
) -> DetectionResult:
    existing_rain = next(
        (inc for inc in existing_incidents if inc.type == IncidentType.HEAVY_RAIN and inc.status != IncidentStatus.RESOLVED),
        None,
    )

    if obs.weather and obs.weather.rainfall and obs.weather.rainfall >= 100:
        has_official_warning = any("heavy rain" in a.type.lower() or "rainfall" in a.type.lower() for a in obs.alerts)

        reasons = [f"Heavy rainfall detected: {obs.weather.rainfall}mm"]
        if has_official_warning:
            reasons.append("Official heavy rainfall warning")

        severity = IncidentSeverity.CRITICAL if obs.weather.rainfall >= 150 else IncidentSeverity.WARNING

        return DetectionResult(
            should_create_incident=True,
            incident_type=IncidentType.HEAVY_RAIN,
            severity=severity,
            risk_score=min(100, int(obs.weather.rainfall / 2)),
            reasons=reasons,
            existing_incident_id=existing_rain.incidentId if existing_rain else None,
        )

    return DetectionResult(should_create_incident=False)


def detect_water_stress_emergency(
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
    existing_incidents: List[Incident],
    thresholds: EmergencyThresholds = DEFAULT_EMERGENCY_THRESHOLDS,
) -> DetectionResult:
    existing_ws = next(
        (inc for inc in existing_incidents if inc.type == IncidentType.WATER_STRESS and inc.status != IncidentStatus.RESOLVED),
        None,
    )

    if assessment.waterStressRisk >= thresholds.water_stress_risk_minimum:
        reasons = [
            f"Water stress risk at {assessment.waterStressRisk}% (incident threshold: {thresholds.water_stress_risk_minimum}%)",
        ]
        reasons.extend(assessment.contributingFactors.get("water_stress", []))

        severity = IncidentSeverity.CRITICAL if assessment.waterStressRisk >= 90 else IncidentSeverity.WARNING

        return DetectionResult(
            should_create_incident=True,
            incident_type=IncidentType.WATER_STRESS,
            severity=severity,
            risk_score=assessment.waterStressRisk,
            reasons=reasons,
            existing_incident_id=existing_ws.incidentId if existing_ws else None,
        )

    return DetectionResult(should_create_incident=False)


def detect_drought_emergency(
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
    existing_incidents: List[Incident],
    thresholds: EmergencyThresholds = DEFAULT_EMERGENCY_THRESHOLDS,
) -> DetectionResult:
    existing_drought = next(
        (inc for inc in existing_incidents if inc.type == IncidentType.DROUGHT and inc.status != IncidentStatus.RESOLVED),
        None,
    )

    if assessment.droughtRisk >= thresholds.drought_risk_minimum:
        reasons = [
            f"Drought risk at {assessment.droughtRisk}% (incident threshold: {thresholds.drought_risk_minimum}%)",
        ]
        reasons.extend(assessment.contributingFactors.get("drought", []))

        has_official = any("drought" in a.type.lower() for a in obs.alerts)
        if has_official:
            reasons.append("Official drought declaration")

        severity = IncidentSeverity.CRITICAL if assessment.droughtRisk >= 90 else IncidentSeverity.WARNING

        return DetectionResult(
            should_create_incident=True,
            incident_type=IncidentType.DROUGHT,
            severity=severity,
            risk_score=assessment.droughtRisk,
            reasons=reasons,
            existing_incident_id=existing_drought.incidentId if existing_drought else None,
        )

    return DetectionResult(should_create_incident=False)


def run_emergency_detection(
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
    existing_incidents: List[Incident],
    thresholds: EmergencyThresholds = DEFAULT_EMERGENCY_THRESHOLDS,
) -> List[DetectionResult]:
    detectors = [
        detect_heat_emergency,
        detect_flood_emergency,
        detect_heavy_rain_emergency,
        detect_water_stress_emergency,
        detect_drought_emergency,
    ]

    results = []
    for detector in detectors:
        result = detector(assessment, obs, existing_incidents, thresholds)
        if result.should_create_incident:
            results.append(result)

    return results


def create_incident(
    detection: DetectionResult,
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
) -> Incident:
    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow()
    next_check = now + timedelta(minutes=5)

    status_map = {
        IncidentSeverity.WARNING: IncidentStatus.WARNING,
        IncidentSeverity.CRITICAL: IncidentStatus.CRITICAL,
        IncidentSeverity.EXTREME: IncidentStatus.EXTREME,
    }

    return Incident(
        incidentId=incident_id,
        locationId=assessment.locationId,
        type=detection.incident_type,
        severity=detection.severity,
        status=status_map.get(detection.severity, IncidentStatus.ACTIVE),
        riskScore=detection.risk_score,
        source=obs.source,
        createdAt=now,
        lastUpdated=now,
        lastChecked=now,
        nextCheck=next_check,
    )


def update_incident(
    incident: Incident,
    detection: DetectionResult,
    assessment: RiskAssessment,
    obs: EnvironmentalObservation,
) -> Incident:
    now = datetime.utcnow()
    next_check = now + timedelta(minutes=5)

    severity_order = {
        IncidentSeverity.WARNING: 1,
        IncidentSeverity.CRITICAL: 2,
        IncidentSeverity.EXTREME: 3,
    }

    current_severity_level = severity_order.get(incident.severity, 0)
    new_severity_level = severity_order.get(detection.severity, 0)

    if new_severity_level > current_severity_level:
        incident.severity = detection.severity
        status_map = {
            IncidentSeverity.WARNING: IncidentStatus.WARNING,
            IncidentSeverity.CRITICAL: IncidentStatus.CRITICAL,
            IncidentSeverity.EXTREME: IncidentStatus.EXTREME,
        }
        incident.status = status_map.get(detection.severity, incident.status)

    incident.riskScore = detection.risk_score
    incident.lastUpdated = now
    incident.lastChecked = now
    incident.nextCheck = next_check

    incident.source = obs.source or incident.source

    return incident


def check_incident_resolution(
    incident: Incident,
    assessment: RiskAssessment,
) -> bool:
    risk_map = {
        IncidentType.HEAT: assessment.heatRisk,
        IncidentType.FLOOD: assessment.floodRisk,
        IncidentType.HEAVY_RAIN: assessment.floodRisk,
        IncidentType.WATER_STRESS: assessment.waterStressRisk,
        IncidentType.DROUGHT: assessment.droughtRisk,
    }
    minimum_map = {
        IncidentType.HEAT: DEFAULT_EMERGENCY_THRESHOLDS.heat_risk_minimum,
        IncidentType.FLOOD: DEFAULT_EMERGENCY_THRESHOLDS.flood_risk_minimum,
        IncidentType.HEAVY_RAIN: DEFAULT_EMERGENCY_THRESHOLDS.flood_risk_minimum,
        IncidentType.WATER_STRESS: DEFAULT_EMERGENCY_THRESHOLDS.water_stress_risk_minimum,
        IncidentType.DROUGHT: DEFAULT_EMERGENCY_THRESHOLDS.drought_risk_minimum,
    }

    current_risk = risk_map.get(incident.type, 0)
    minimum_risk = minimum_map.get(incident.type, DEFAULT_EMERGENCY_THRESHOLDS.drought_risk_minimum)

    if current_risk < minimum_risk and incident.status != IncidentStatus.RESOLVED:
        return True

    return False


def resolve_incident(incident: Incident) -> Incident:
    incident.status = IncidentStatus.RESOLVED
    incident.lastUpdated = datetime.utcnow()
    incident.nextCheck = None
    return incident