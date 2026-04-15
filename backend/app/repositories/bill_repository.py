from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.bill import Bill
from app.models.customer import Customer


class BillRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(
        self,
        page: int,
        page_size: int,
        search: str | None = None,
        customer_pk: int | None = None,
    ) -> tuple[list[Bill], int]:
        query = (
            self.db.query(Bill)
            .join(Customer, Customer.id == Bill.customer_id)
            .options(joinedload(Bill.customer))
            .filter(Bill.is_deleted.is_(False), Customer.is_deleted.is_(False))
        )

        if customer_pk is not None:
            query = query.filter(Bill.customer_id == customer_pk)

        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Bill.bill_number.ilike(pattern),
                    Bill.customer_name_snapshot.ilike(pattern),
                    Bill.product_name.ilike(pattern),
                    Bill.frame_name.ilike(pattern),
                    Customer.customer_id.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.contact_no.ilike(pattern),
                    Customer.whatsapp_no.ilike(pattern),
                )
            )

        total = query.count()
        items = (
            query.order_by(Bill.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_by_id(self, bill_id: int, include_deleted: bool = False) -> Bill | None:
        query = self.db.query(Bill).options(joinedload(Bill.customer))
        if not include_deleted:
            query = query.filter(Bill.is_deleted.is_(False))
        return query.filter(Bill.id == bill_id).first()

    def get_by_bill_number(self, bill_number: str) -> Bill | None:
        return self.db.query(Bill).filter(Bill.bill_number == bill_number).first()

    def count_created_for_day(self, target_date: date) -> int:
        start = datetime.combine(target_date, time.min, tzinfo=UTC)
        end = start + timedelta(days=1)
        return (
            self.db.query(Bill.id)
            .filter(Bill.created_at >= start, Bill.created_at < end)
            .count()
        )

    def create(self, bill: Bill) -> Bill:
        self.db.add(bill)
        self.db.flush()
        return bill

    def save(self, bill: Bill) -> Bill:
        self.db.add(bill)
        self.db.flush()
        return bill
