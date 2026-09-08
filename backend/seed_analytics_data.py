"""
seed_analytics_data.py — Add dummy assessment data for analytics visualization.

Creates ~60 assessments spread over the past 6 months across multiple diseases,
so the analytics charts (bar, donut, line) have meaningful data to display.

Usage:
    cd backend
    python seed_analytics_data.py
"""
import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings


async def main():
    engine = create_async_engine(settings.async_database_url, echo=False)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        async with session.begin():
            # Get existing disease IDs
            result = await session.execute(text("SELECT id, name FROM diseases WHERE is_active = true"))
            diseases = result.fetchall()
            if not diseases:
                print("[seed] No diseases found. Please run seed.py first and create diseases.")
                return

            # Get doctor user ID
            result = await session.execute(text("SELECT id FROM users WHERE role = 'doctor' LIMIT 1"))
            doctor = result.fetchone()
            if not doctor:
                print("[seed] No doctor user found. Please run seed.py first.")
                return
            doctor_id = doctor[0]

            # Get patient IDs
            result = await session.execute(text("SELECT id FROM patients WHERE is_active = true"))
            patients = result.fetchall()

            # If no patients, create some dummy ones
            if not patients:
                print("[seed] Creating dummy patients...")
                for i in range(10):
                    await session.execute(text("""
                        INSERT INTO patients (patient_uid, first_name, last_name, date_of_birth, gender, contact_number, registered_by, is_active)
                        VALUES (:uid, :fn, :ln, :dob, :gender, :contact, :doc, true)
                    """), {
                        "uid": f"PAT-{100001 + i}",
                        "fn": random.choice(["Ramesh", "Priya", "Anil", "Sunita", "Vikram", "Kavita", "Rajesh", "Meena", "Suresh", "Anjali"]),
                        "ln": random.choice(["Sharma", "Patel", "Kumar", "Singh", "Gupta", "Mehta", "Joshi", "Verma", "Das", "Reddy"]),
                        "dob": f"{random.randint(1960, 2000)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                        "gender": random.choice(["Male", "Female"]),
                        "contact": f"98{random.randint(10000000, 99999999)}",
                        "doc": doctor_id,
                    })
                result = await session.execute(text("SELECT id FROM patients WHERE is_active = true"))
                patients = result.fetchall()

            patient_ids = [p[0] for p in patients]
            disease_ids = [d[0] for d in diseases]
            disease_names = {d[0]: d[1] for d in diseases}

            # Get template IDs for each disease
            result = await session.execute(text("SELECT id, disease_id FROM form_templates WHERE is_active = true"))
            templates = {row[1]: row[0] for row in result.fetchall()}

            print(f"[seed] Found {len(disease_ids)} diseases, {len(patient_ids)} patients, {len(templates)} templates")
            print(f"[seed] Diseases: {disease_names}")

            # Create assessments spread over the last 6 months
            now = datetime.now(tz=timezone.utc)
            statuses = ["draft", "submitted", "locked"]
            status_weights = [0.15, 0.35, 0.5]  # more locked/submitted than drafts

            count = 0
            for months_ago in range(6):
                # More assessments in recent months
                num_assessments = random.randint(8, 15) if months_ago < 3 else random.randint(4, 8)

                for _ in range(num_assessments):
                    disease_id = random.choice(disease_ids)
                    patient_id = random.choice(patient_ids)
                    template_id = templates.get(disease_id, list(templates.values())[0] if templates else 1)
                    status = random.choices(statuses, weights=status_weights, k=1)[0]

                    # Random date within the month
                    days_ago = months_ago * 30 + random.randint(0, 29)
                    created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))

                    submitted_at = None
                    locked_at = None
                    lock_expires_at = None

                    if status in ("submitted", "locked"):
                        submitted_at = created_at + timedelta(hours=random.randint(1, 4))
                    if status == "locked":
                        locked_at = submitted_at + timedelta(hours=24) if submitted_at else None

                    form_data = {
                        "chief_complaint": random.choice(["Fever", "Cough", "Pain", "Fatigue", "Swelling", "Breathing difficulty"]),
                        "duration": random.choice(["2 days", "1 week", "2 weeks", "1 month"]),
                        "severity": random.choice(["Mild", "Moderate", "Severe"]),
                    }

                    await session.execute(text("""
                        INSERT INTO assessments 
                        (patient_id, doctor_id, disease_id, template_id, template_snapshot, form_data, 
                         status, consent_given, submitted_at, locked_at, lock_expires_at, created_at, updated_at)
                        VALUES 
                        (:patient_id, :doctor_id, :disease_id, :template_id, :template_snapshot, :form_data,
                         :status, true, :submitted_at, :locked_at, :lock_expires_at, :created_at, :created_at)
                    """), {
                        "patient_id": patient_id,
                        "doctor_id": doctor_id,
                        "disease_id": disease_id,
                        "template_id": template_id,
                        "template_snapshot": "{}",
                        "form_data": str(form_data).replace("'", '"'),
                        "status": status,
                        "submitted_at": submitted_at,
                        "locked_at": locked_at,
                        "lock_expires_at": lock_expires_at,
                        "created_at": created_at,
                    })
                    count += 1

            print(f"[seed] Created {count} dummy assessments across 6 months.")
            print("[seed] Done! Refresh your analytics dashboard to see the charts.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
