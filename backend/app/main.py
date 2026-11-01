from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.endpoints.players import router as players_router
from app.api.v1.endpoints.teams import router as teams_router
from app.api.v1.endpoints.optimizer import router as optimizer_router
from app.api.v1.endpoints.lineups import router as lineups_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="FPL Lineup Builder & Optimizer Backend Core API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 Router
api_v1_router = APIRouter(prefix=settings.API_V1_STR)


@api_v1_router.get("/health", tags=["Health"])
async def api_health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


# Include endpoint routers
api_v1_router.include_router(players_router, prefix="/players")
api_v1_router.include_router(teams_router, prefix="/teams")
api_v1_router.include_router(optimizer_router)
api_v1_router.include_router(lineups_router)

# Include API v1 Router into App
app.include_router(api_v1_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to Fantasy Football Lineup Optimizer API",
        "docs_url": "/docs",
        "health": "/health",
        "version": settings.VERSION,
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
