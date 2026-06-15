"""First-boot database initialisation.

Creates all tables if the schema is empty, then stamps Alembic head so future
schema changes flow through `alembic revision --autogenerate` + `alembic upgrade`.
Safe to run repeatedly (used by the Docker entrypoint).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import sqlalchemy as sa  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402
import app.models  # noqa: E402,F401


def main() -> None:
    engine = sa.create_engine(settings.database_sync_url)
    Base.metadata.create_all(engine)
    print("Database schema ensured.")


if __name__ == "__main__":
    main()
