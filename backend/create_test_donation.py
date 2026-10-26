from app.db.session import SessionLocal
from app.models.project import Project
from app.models.donation import Donation

db = SessionLocal()

try:
    project_id = "TEST-CHAIN-001"
    donation_id = "TEST-DON-001"

    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if project is None:
        raise RuntimeError("Test project not found in SQLite.")

    donation = db.query(Donation).filter(
        Donation.id == donation_id
    ).first()

    if donation is None:
        donation = Donation(
            id=donation_id,
            project_id=project_id,
            donor_name="LOCAL BLOCKCHAIN TEST",
            amount=100,
            currency="INR",
            status="PENDING",
            payment_status="Pending",
            blockchain_status="Not submitted",
            notes="TEST ONLY - no real payment",
        )
        db.add(donation)
        db.commit()
        db.refresh(donation)

    print("Donation ID:", donation.id)
    print("Project ID:", donation.project_id)
    print("Amount:", donation.amount)
    print("Payment status:", donation.payment_status)
    print("Blockchain status:", donation.blockchain_status)
    print("Project raised total:", project.raised_amount)

finally:
    db.close()
