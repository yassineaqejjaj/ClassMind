import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import assessments, classes, exercises, misc
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")


def create_app() -> FastAPI:
    app = FastAPI(title="ClassMind API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins.split(","),
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )
    api = APIRouter(prefix="/api")
    for r in (misc.router, classes.router, assessments.router, exercises.router):
        api.include_router(r)
    app.include_router(api)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    return app


app = create_app()
