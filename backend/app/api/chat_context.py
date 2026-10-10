from typing import Any

from app.database.models import EnvironmentalObservation


def build_observation_context(
    observation: EnvironmentalObservation | None,
) -> dict[str, Any] | None:
    if not observation:
        return None

    return {
        "observed_at": observation.timestamp.isoformat(),
        "source": observation.source,
        "weather": observation.weather.model_dump(exclude_none=True) if observation.weather else None,
        "water": observation.water.model_dump(exclude_none=True) if observation.water else None,
        "alerts": [
            {
                "type": alert.type,
                "severity": alert.severity,
                "description": alert.description[:500],
                "issued_at": alert.issuedAt.isoformat(),
            }
            for alert in observation.alerts[:10]
        ],
    }
