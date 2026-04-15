from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.repositories.user_repository import UserRepository


def seed_users(db: Session) -> None:
    user_repo = UserRepository(db)

    if not user_repo.get_by_email("admin@aadarsh-eye.com"):
        user_repo.create(
            email="admin@aadarsh-eye.com",
            full_name="Aadarsh Admin",
            password_hash=get_password_hash("Admin@12345"),
            role=UserRole.ADMIN,
        )

    if not user_repo.get_by_email("staff@aadarsh-eye.com"):
        user_repo.create(
            email="staff@aadarsh-eye.com",
            full_name="Aadarsh Staff",
            password_hash=get_password_hash("Staff@12345"),
            role=UserRole.STAFF,
        )


def main() -> None:
    with SessionLocal() as db:
        seed_users(db)
        db.commit()


if __name__ == "__main__":
    main()
