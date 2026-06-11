"""First-boot database initialisation.

Creates all tables if the schema is empty, then stamps Alembic head so future
schema changes flow through `alembic revision --autogenerate` + `alembic upgrade`.
Safe to run repeatedly (used by the Docker entrypoint).
"""
import sqlalchemy as sa

from app.core.config import settings
from app.core.database import Base
import app.models  # noqa: F401


def main() -> None:
    engine = sa.create_engine(settings.database_sync_url)
    Base.metadata.create_all(engine)
    print("Database schema ensured.")


if __name__ == "__main__":
    main()
