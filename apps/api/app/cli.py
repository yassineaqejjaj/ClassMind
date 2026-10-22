"""Commandes d'exploitation : python -m app.cli [seed|purge]."""

import sys

from app.core.db import get_db
from app.services.curriculum import seed_curriculum
from app.services.retention import purge_expired


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    db = next(get_db())
    if cmd == "seed":
        seed_curriculum(db)
        print("Référentiel de cinquième chargé.")
    elif cmd == "purge":
        print(f"{purge_expired(db)} évaluation(s) expirée(s) supprimée(s).")
    else:
        sys.exit("Usage : python -m app.cli [seed|purge]")


if __name__ == "__main__":
    main()
