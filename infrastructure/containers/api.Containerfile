FROM docker.io/library/python:3.12-slim
ENV PYTHONUNBUFFERED=1 UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* && pip install --no-cache-dir uv
WORKDIR /srv/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api ./
COPY ai /srv/ai
ENV PYTHONPATH=/srv/apps/api:/srv
RUN useradd -r -u 10001 classmind && chown -R classmind /srv
USER classmind
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.cli seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
