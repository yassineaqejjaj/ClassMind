#!/usr/bin/env sh
# À planifier (cron/systemd timer) : supprime les évaluations au-delà de la durée de conservation.
podman compose exec api python -m app.cli purge
