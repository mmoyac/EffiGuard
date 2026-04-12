import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings

# Asegurar que el directorio de logos exista
_LOGOS_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "logos")
os.makedirs(_LOGOS_DIR, exist_ok=True)

app = FastAPI(
    title="EffiGuard API",
    description="SaaS de gestión de activos, control de bodega y prevención de robos.",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

import re

_BASE = re.escape(settings.BASE_DOMAIN)
_CORS_REGEX = rf"^https://effiguard-[^.]+\.{_BASE}$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not settings.is_production else [],
    allow_origin_regex=None if not settings.is_production else _CORS_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Servir archivos estáticos (logos de tenants, etc.)
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
