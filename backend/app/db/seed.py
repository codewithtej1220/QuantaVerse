from __future__ import annotations

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models import User

"""
Example mentors, so a fresh install has a directory to browse.

Every one of these is invented. They are named after the physics rather than
after people — "Dr. Anaya Rao" would be indistinguishable from a real academic,
and a directory that ships convincing fake professors is a directory that will
eventually be screenshotted as if the people were real. These carry
`is_demo=True`, the UI labels them, and their passwords are random bytes nobody
holds, so none of them can be signed into.

They exist to make the hub demonstrable. Delete the rows and the feature works
exactly the same with real members.
"""

DEMO_MENTORS: list[dict[str, str]] = [
    {
        "handle": "mentor-error-correction",
        "display_name": "Example Mentor · Error Correction",
        "institution": "Demonstration Lab, QuantaVerse",
        "headline": "Surface codes, syndrome extraction, and why nine qubits protect one.",
        "interests": "error correction, surface code, stabilisers, fault tolerance",
    },
    {
        "handle": "mentor-algorithms",
        "display_name": "Example Mentor · Algorithms",
        "institution": "Demonstration Lab, QuantaVerse",
        "headline": "Grover, Shor, and the honest question of where the speed-up actually comes from.",
        "interests": "grover, shor, amplitude amplification, query complexity",
    },
    {
        "handle": "mentor-hardware",
        "display_name": "Example Mentor · Hardware",
        "institution": "Demonstration Lab, QuantaVerse",
        "headline": "Transmons, coherence budgets, and reading a calibration report.",
        "interests": "superconducting qubits, transpilation, noise, calibration",
    },
    {
        "handle": "mentor-simulation",
        "display_name": "Example Mentor · Simulation",
        "institution": "Demonstration Lab, QuantaVerse",
        "headline": "Statevector and tensor-network simulation — what a laptop can and cannot hold.",
        "interests": "statevector, tensor networks, benchmarking, qiskit aer",
    },
]


def seed_demo_mentors(session: Session) -> int:
    """
    Insert the example mentors that are missing. Safe to run on every boot.

    Matched on handle, so an install that has them already is untouched and one
    that has had a row deleted on purpose does not get it back — the handles
    are reserved names, not a fixture that keeps reasserting itself.
    """
    existing = set(
        session.scalars(
            select(User.handle).where(
                User.handle.in_([entry["handle"] for entry in DEMO_MENTORS])
            )
        ).all()
    )

    # Only seed an empty-ish directory. Once a real cohort is using the hub,
    # a deleted example should stay deleted.
    if existing:
        pending = [entry for entry in DEMO_MENTORS if entry["handle"] not in existing]
        if not pending:
            return 0
        real_members = int(
            session.scalar(
                select(func.count()).select_from(User).where(User.is_demo.is_(False))
            )
            or 0
        )
        if real_members > len(DEMO_MENTORS):
            return 0
    else:
        pending = list(DEMO_MENTORS)

    for entry in pending:
        session.add(
            User(
                email=f"{entry['handle']}@demo.invalid",
                handle=entry["handle"],
                display_name=entry["display_name"],
                # Random and discarded: these accounts are not sign-in-able.
                password_hash=hash_password(secrets.token_urlsafe(32)),
                institution=entry["institution"],
                role="mentor",
                headline=entry["headline"],
                interests=entry["interests"],
                open_to_mentoring=True,
                is_demo=True,
            )
        )

    session.commit()
    return len(pending)
