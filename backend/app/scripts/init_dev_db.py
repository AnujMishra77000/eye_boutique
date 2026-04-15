from __future__ import annotations

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.scripts.seed import seed_users


def main() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        # Local development initializer: keep it deterministic and simple.
        seed_users(db)
        db.commit()


if __name__ == "__main__":
    main()
