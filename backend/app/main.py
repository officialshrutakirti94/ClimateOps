from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.api.routes import climate, incidents, monitoring, simulation
from app.config import settings
from app.database.dynamodb import close_dynamodb, init_dynamodb
from app.database.sqlite import close_sqlite, init_sqlite

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer() if settings.LOG_FORMAT == "json" else structlog.dev.ConsoleRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting ClimateOps Backend", env=settings.APP_ENV)

    if settings.use_local_dynamodb() or settings.is_development():
        await init_sqlite()
        logger.info("SQLite initialized for local development")
    else:
        await init_dynamodb()
        logger.info("DynamoDB initialized")

    from app.api.deps import get_monitoring_service

    monitoring_service = get_monitoring_service()
    app.state.monitoring_service = monitoring_service
    try:
        await monitoring_service.start_monitoring()
        yield
    finally:
        try:
            await monitoring_service.stop_monitoring()
        finally:
            if settings.use_local_dynamodb() or settings.is_development():
                await close_sqlite()
            else:
                await close_dynamodb()
            logger.info("Shutting down ClimateOps Backend")


app = FastAPI(
    title="ClimateOps API",
    description="Climate Intelligence & Emergency Response Platform",
    version="0.1.0",
    root_path=settings.asgi_root_path,
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
    openapi_url="/openapi.json" if settings.APP_DEBUG else None,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(climate.router, prefix="/api", tags=["Climate Intelligence"])
app.include_router(simulation.router, prefix="/api/climate", tags=["Simulation"])
app.include_router(simulation.simulation_lookup_router, prefix="/api", tags=["Simulation"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Emergency Ops"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Live Monitoring"])


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "climatify-backend",
        "version": "0.1.0",
        "environment": settings.APP_ENV,
    }


@app.get("/", tags=["Root"])
async def root() -> dict:
    return {
        "name": "ClimateOps API",
        "version": "0.1.0",
        "description": "Climate Intelligence & Emergency Response Platform",
        "docs": "/docs" if settings.APP_DEBUG else "disabled",
    }
