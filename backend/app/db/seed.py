from __future__ import annotations

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models import User

"""
Example mentors, so a fresh install has a directory worth browsing.

Every one of these is invented, and that is not a detail to gloss over. Naming
them after the physics — "Example Mentor · Error Correction" — was the previous
approach and it was safe, but it read as placeholder text and made the whole
page look unfinished. These have ordinary names and full profiles instead,
which is what a directory is supposed to look like.

What keeps that honest is the labelling rather than the naming. Every row
carries `is_demo=True`, the card prints "example profile" beside the name, the
opened panel says so again in a sentence, and the passwords are random bytes
nobody holds — so none of these can be signed into and none of them claims to
be anybody. No real academic's name appears here, and no real institution is
named as employing someone who does not exist: putting a genuine person's name
against invented supervision history would be fabricating a record about them.

Delete these rows and the feature works exactly the same with real members.
"""

DEMO_MENTORS: list[dict[str, object]] = [
    {
        "handle": "h-marsh",
        "avatar_url": "/avatars/h-marsh.webp",
        "display_name": "Prof. Helena Marsh",
        "institution": "Institute for Quantum Systems",
        "position": "Professor of Physics · Quantum Error Correction Group",
        "headline": "Surface codes, syndrome extraction, and why nine physical qubits protect one.",
        "interests": "error correction, surface code, stabilisers, fault tolerance, decoders",
        "education": (
            "PhD in Theoretical Physics, 2009 · MSc in Mathematics, 2005. "
            "Postdoctoral work on topological codes before joining the institute in 2013."
        ),
        "focus": (
            "Fault-tolerant architectures, and specifically what the overhead actually is once "
            "you stop assuming a perfect decoder. Recent work is on real-time syndrome decoding "
            "fast enough to keep up with a superconducting device, which is the bottleneck "
            "nobody writes papers about. Happy to explain why the thousand-to-one physical-to-"
            "logical ratio is an estimate rather than a constant."
        ),
        "mentoring": (
            "Supervised 21 undergraduate projects and 6 masters theses since 2014, most of them "
            "first contact with the subject rather than specialist work. Two former mentees now "
            "work on decoder hardware. Prefers a standing half-hour a fortnight to an open door "
            "nobody walks through, and asks mentees to bring a circuit rather than a question."
        ),
        "availability": "Two mentee slots this term · replies within a few days",
    },
    {
        "handle": "a-ndukwe",
        "avatar_url": "/avatars/a-ndukwe.webp",
        "display_name": "Dr. Adaora Ndukwe",
        "institution": "Centre for Quantum Algorithms",
        "position": "Senior Lecturer · Algorithms and Complexity",
        "headline": "Grover, Shor, and the honest question of where the speed-up actually comes from.",
        "interests": "grover, shor, amplitude amplification, query complexity, oracles",
        "education": (
            "PhD in Computer Science, 2013 · BSc in Mathematics, 2008. "
            "Thesis on query lower bounds for search problems."
        ),
        "focus": (
            "Query complexity and the gap between what an algorithm promises on paper and what "
            "it delivers once the oracle has to be built out of gates. Particularly interested "
            "in how often a quoted exponential speed-up is really against a deterministic "
            "classical baseline that nobody would use. Will happily talk you out of believing "
            "Deutsch–Jozsa matters practically while insisting you learn it anyway."
        ),
        "mentoring": (
            "Ran the department's undergraduate quantum reading group for five years and has "
            "supervised 14 projects. Known for asking a mentee to state the classical algorithm "
            "first, and for refusing to discuss a speed-up until they can. Comfortable with "
            "people who have strong programming backgrounds and no physics."
        ),
        "availability": "Open to short questions · project supervision from next term",
    },
    {
        "handle": "r-duarte",
        "avatar_url": "/avatars/r-duarte.webp",
        "display_name": "Prof. Rafael Duarte",
        "institution": "Laboratory for Superconducting Devices",
        "position": "Professor · Experimental Quantum Hardware",
        "headline": "Transmons, coherence budgets, and how to read a calibration report.",
        "interests": "superconducting qubits, transmons, calibration, noise, transpilation",
        "education": (
            "PhD in Applied Physics, 2004 · Ten years in industry on device fabrication "
            "before returning to academia in 2016."
        ),
        "focus": (
            "Building and characterising superconducting qubits, and the unglamorous work of "
            "keeping them calibrated. Most useful to a student who has written a circuit that "
            "works in simulation and returns noise on hardware — that gap is his whole subject. "
            "Will show you which line of a calibration report explains your result."
        ),
        "mentoring": (
            "Has hosted 30-odd lab visits for students who had never seen a dilution "
            "refrigerator, and supervises four research students at a time. Blunt about the fact "
            "that most experimental work is debugging. Asks prospective mentees what they think "
            "the hardest part of the experiment is, and is more interested in the reasoning than "
            "in the answer."
        ),
        "availability": "Lab visits by arrangement · not taking new students until autumn",
    },
    {
        "handle": "s-bakker",
        "avatar_url": "/avatars/s-bakker.webp",
        "display_name": "Dr. Sanne Bakker",
        "institution": "Institute for Quantum Systems",
        "position": "Research Fellow · Simulation and Benchmarking",
        "headline": "Statevector and tensor-network simulation — what a laptop can and cannot hold.",
        "interests": "statevector, tensor networks, benchmarking, qiskit aer, simulation",
        "education": "PhD in Computational Physics, 2018 · MSc in Computer Science, 2014.",
        "focus": (
            "Classical simulation of quantum circuits, which is both how you check a quantum "
            "computer and how you argue about whether it did anything a classical machine could "
            "not. Works on tensor-network methods that push far past the fifty-qubit statevector "
            "wall for circuits with the right structure. Good person to ask why your simulation "
            "ran out of memory."
        ),
        "mentoring": (
            "Mentored 9 students through first simulation projects and maintains the teaching "
            "notebooks the group uses. Strong preference for mentees who will actually run the "
            "code rather than read about it, and will cheerfully spend a session debugging "
            "somebody's environment because that is usually the real obstacle."
        ),
        "availability": "Open to mentoring · usually replies the same week",
    },
]


def seed_demo_mentors(session: Session) -> int:
    """
    Insert the example mentors, once.

    Idempotent on handle, so restarting the server does not duplicate anybody
    and an operator who has deleted a row does not have it forced back.
    """
    existing = {
        handle
        for (handle,) in session.execute(
            select(User.handle).where(User.handle.in_([m["handle"] for m in DEMO_MENTORS]))
        )
    }

    added = 0
    for entry in DEMO_MENTORS:
        if entry["handle"] in existing:
            continue

        session.add(
            User(
                email=f"{entry['handle']}@demo.invalid",
                handle=str(entry["handle"]),
                display_name=str(entry["display_name"]),
                # Random bytes nobody keeps. These accounts exist to be listed,
                # never to be signed into.
                password_hash=hash_password(secrets.token_urlsafe(32)),
                institution=str(entry["institution"]),
                role="mentor",
                headline=str(entry["headline"]),
                interests=str(entry["interests"]),
                position=str(entry["position"]),
                education=str(entry["education"]),
                focus=str(entry["focus"]),
                mentoring=str(entry["mentoring"]),
                availability=str(entry["availability"]),
                avatar_url=str(entry["avatar_url"]),
                open_to_mentoring=True,
                is_demo=True,
            )
        )
        added += 1

    # Pictures arrived after these accounts already existed, so rows seeded by an
    # earlier version would otherwise never get one. Only filled where empty and
    # only on example profiles: a picture somebody set is never overwritten, and
    # a real member's row is never touched.
    pictures = {m["handle"]: m["avatar_url"] for m in DEMO_MENTORS}
    backfilled = 0
    for user in session.scalars(
        select(User).where(User.is_demo, User.handle.in_(list(pictures)), User.avatar_url.is_(None))
    ):
        user.avatar_url = str(pictures[user.handle])
        backfilled += 1

    if added or backfilled:
        session.commit()
    return added


def demo_mentor_count(session: Session) -> int:
    return int(session.scalar(select(func.count()).select_from(User).where(User.is_demo)) or 0)
