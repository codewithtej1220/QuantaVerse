# QuantaVerse API

The simulation, grading and tutoring service behind the QuantaVerse site. FastAPI,
one canonical circuit IR, four adapters that all answer in the same shape, and a
student record that remembers what a learner has finished.

The site runs without this service — the sandbox has its own statevector
simulator in the browser. Start the API when you want real Qiskit, Cirq or
PennyLane behind the run button, a graded circuit task, a tutor that reads the
circuit you have on screen, or an account whose progress survives a page reload.

Accounts are opt-in and local. The database is a SQLite file next to this README,
nothing is sent anywhere, and every simulation, grading and tutor endpoint still
answers without a token.

## Setup

Python 3.11 or 3.12. On Windows use `py` so the venv gets Windows wheels; an
MSYS2 or Git Bash `python` produces a POSIX-layout venv that Qiskit will not
install into.

```bash
cd backend && py -3.11 -m venv .venv
```

```bash
source .venv/Scripts/activate && pip install -r requirements.txt
```

On macOS or Linux: `python3.11 -m venv .venv && source .venv/bin/activate`.

```bash
uvicorn app.main:app --reload
```

That serves `http://127.0.0.1:8000`, with interactive docs at `/docs`. The
frontend looks there by default; point it elsewhere with `NEXT_PUBLIC_API_URL`
in the repo root's `.env.local`.

Cirq and PennyLane are optional. If a framework is missing, `/api/health`
reports it as not installed and the sandbox's engine picker greys that button
out instead of failing at run time.

## Configuration

Copy `.env.example` to `.env`. Every value has a working default, so an empty
file is a valid file.

| Variable | Default | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | empty | Unset, the tutor answers from its own analysis. Set, it streams from a model. |
| `OPENAI_BASE_URL` | unset | Any OpenAI-compatible endpoint. Empty means OpenAI itself. |
| `QUANTAVERSE_TUTOR_MODEL` | `gpt-4o-mini` | Model for the live tutor. Must match the provider. |
| `QUANTAVERSE_TUTOR_TEMPERATURE` | `0.3` | Low: it is explaining maths. |
| `QUANTAVERSE_TUTOR_MAX_TOKENS` | `700` | Cap per answer, reasoning included. |

### Running the tutor for free

The names are the OpenAI SDK's conventions, not a commitment to OpenAI. The
package is Apache-2.0 and only sends HTTP; it talks to whatever `OPENAI_BASE_URL`
names. Groq implements the same API and has a free tier:

```
OPENAI_API_KEY=<a groq key>
OPENAI_BASE_URL=https://api.groq.com/openai/v1
QUANTAVERSE_TUTOR_MODEL=openai/gpt-oss-120b
QUANTAVERSE_TUTOR_MAX_TOKENS=1200
```

Two things that will bite otherwise:

- **The model must match the provider.** `gpt-4o-mini` is the default and Groq
  does not serve it, so a Groq key on its own fails on every request.
- **Failure is quiet by design.** Any error falls back to the read-out so the
  site never breaks, which means a misconfigured tutor looks like a working one
  that gives short answers. `GET /api/tutor/status` reports `configured_model`
  and `configured_base_url` whether or not the tutor is live, and the exception
  is logged at warning level.

Groq's catalogue rotates, so confirm the model still exists rather than trusting
this file: `curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $KEY"`. Reasoning
models — `openai/gpt-oss-*` among them — spend part of `MAX_TOKENS` thinking
before they write, which is why the budget above is raised; at 700,
`gpt-oss-20b` truncated mid-answer.
| `QUANTAVERSE_ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins. Narrow this before you deploy. |
| `QUANTAVERSE_DEFAULT_BACKEND` | `qiskit` | Used when a request omits `backend`. |
| `QUANTAVERSE_DEFAULT_SHOTS` | `1024` | Used when a request omits `shots`. |
| `QUANTAVERSE_SANDBOX_TIMEOUT` | `5` | Seconds of user code before the child process is killed. |
| `QUANTAVERSE_HOST` / `QUANTAVERSE_PORT` | `127.0.0.1` / `8000` | Only used by `python -m app.main`. |
| `QUANTAVERSE_DATABASE_URL` | `sqlite:///backend/quantaverse.db` | Any SQLAlchemy URL. Point it at Postgres to share one record across machines. |
| `QUANTAVERSE_DATABASE_ECHO` | `0` | Log every statement. Loud; useful once. |
| `QUANTAVERSE_JWT_SECRET` | empty | **Set this.** Left empty, a random key is minted per boot and every token dies on restart. |
| `QUANTAVERSE_ACCESS_TOKEN_MINUTES` | `30` | Access token lifetime. |
| `QUANTAVERSE_REFRESH_TOKEN_DAYS` | `30` | Refresh token lifetime. |
| `QUANTAVERSE_MAX_SESSIONS` | `10` | Live refresh tokens per student. The oldest is retired past the cap. |
| `QUANTAVERSE_REGISTRATION_OPEN` | `1` | Set `0` to close `/api/auth/register` on a shared instance. |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Version, per-framework install status and version, tutor mode. |
| GET | `/api/backends` | Backend names, aliases and the supported gate set. |
| POST | `/api/simulate` | Run a circuit IR on `qiskit`, `cirq`, `pennylane` or `qbraid`. |
| POST | `/api/grade` | Compare a submission against a target circuit. Send `challenge_slug` with a token and the attempt is filed against the student's record. |
| POST | `/api/introspect` | Execute a Qiskit snippet and return the circuit it built. |
| POST | `/api/tutor/ask` | SSE stream of an answer about the learner's circuit. |
| POST | `/api/tutor/explain` | The same analysis as one JSON response, no streaming. |
| GET | `/api/tutor/status` | Whether a model key is present. |

### Accounts

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a student. Returns the profile and a token pair. |
| POST | `/api/auth/login` | Exchange email and password for a token pair. |
| POST | `/api/auth/refresh` | Rotate a refresh token. The old one dies on use. |
| POST | `/api/auth/logout` | Retire one session, or every session with `{"everywhere": true}`. |
| GET | `/api/auth/me` | The signed-in student's profile. |
| PATCH | `/api/auth/me` | Change display name or institution. |
| POST | `/api/auth/password` | Change password. Signs out every other session and returns fresh tokens. |
| GET | `/api/auth/sessions` | Live sessions, with the current one flagged. |

### Progress

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/catalog` | The curriculum: modules, lessons, labs, badges, skill axes. No token needed. |
| GET | `/api/progress` | Stats, mastery, per-module rows, skills, badges and what to do next. |
| POST | `/api/progress/lessons` | Mark a lesson finished. Idempotent; repeat calls only add time. |
| DELETE | `/api/progress/lessons/{module}/{index}` | Undo a lesson. |
| GET | `/api/progress/exercises` | Every lab with attempts, best score and success rate. |
| POST | `/api/progress/exercises` | File a lab attempt scored on the client. |
| GET | `/api/dashboard` | Everything the dashboard draws, in one call. |

### The circuit IR

One JSON shape travels everywhere. `step` is the time column, `control` is null
for single-qubit gates, and `wires` order is always control first:

```json
{
  "qubits": 3,
  "clbits": 0,
  "timeline": [
    { "gate": "h", "control": null, "targets": [0], "params": [], "step": 0 },
    { "gate": "cx", "control": 0, "targets": [1], "params": [], "step": 1 }
  ],
  "measurements": []
}
```

Limits are 12 qubits, 12 classical bits and 512 operations, and 26 gates are
supported — `GET /api/backends` lists them. Per-gate arity and parameter counts
are validated, so a `cx` without a control is a 422 with a sentence explaining
why, not a stack trace.

### Qubit order

**Qubit 0 is the least significant bit**, as in Qiskit. Cirq is built with
`qubit_order=reversed(LineQubit.range(n))` and PennyLane maps IR qubit `i` to
wire `n-1-i` so that all three produce byte-identical statevectors. Histogram
keys are written most-significant-qubit-first, `q(n-1) … q0`, matching the
`labels` array in the same response.

This is verified with an asymmetric circuit, not a Bell pair — a Bell pair is
symmetric and cannot detect a flipped register.

```bash
curl -s localhost:8000/api/simulate -H "content-type: application/json" -d '{"backend":"cirq","shots":1024,"circuit":{"qubits":3,"timeline":[{"gate":"x","targets":[0],"step":0},{"gate":"h","targets":[2],"step":0}]}}'
```

### Backends

`qiskit` runs AerSimulator. `cirq` and `pennylane` build native circuits.
`qbraid` is a **stub**: it returns a uniform distribution and reports
`"status": "stub"` with a note saying so, because there is no credentialed
hardware behind it. The sandbox's engine picker deliberately does not offer it —
a mock distribution should never be plotted as physics.

Aliases resolve to the real adapters: `aer` and `ibm` to Qiskit, `google` to
Cirq, `xanadu` to PennyLane, `braket` to qBraid. An unknown name is a 400 that
lists what is available.

### Grading

`/api/grade` runs two checks with `qiskit.quantum_info`: state fidelity against
the target statevector, and unitary equivalence up to global phase, scored with
process fidelity so a near miss reads as a number rather than a boolean. It
returns each check's score with its threshold, plus a hint naming the first thing
that differs — a gate the target uses more of, a depth mismatch, or the same
gates on the wrong wires. Passing the state check while failing the unitary one
gets its own hint: the circuit is right from `|0…0>` and wrong in general, which
is the mistake a Z on an untouched qubit produces.

### The tutor

Every answer is grounded in the posted IR. The service rebuilds the circuit,
computes the statevector, per-outcome probabilities and per-qubit purity, and
sends that digest as context. With no key it streams that read-out directly and
ends with `"source": "offline"`; the frontend labels the panel *local read-out*
so nobody mistakes arithmetic for a model.

Frames are `data: {json}\n\n`, typed `meta`, `delta`, `done` or `error`. The
client parses them off a plain `fetch` body rather than `EventSource`, which
cannot POST.

## Accounts and progress

Five tables, all keyed to `users.id` and all cascading on delete:

| Table | Holds |
| --- | --- |
| `users` | Email, derived handle, display name, bcrypt hash, institution, timestamps. |
| `auth_sessions` | One row per live refresh token, stored as a SHA-256 digest. |
| `lesson_completions` | One row per lesson a student finished, plus time spent. Unique on `(user, module, lesson)`. |
| `exercise_attempts` | Every graded circuit submission: pass, score, fidelities, gate count, depth. |
| `earned_badges` | One row per module badge, awarded once. |

Passwords are bcrypt at 12 rounds and never leave the database. A login that
names an unknown account still runs a hash so it takes the same time as a wrong
password, and both answer with the same message.

Access tokens are short-lived HS256 JWTs carried in `Authorization: Bearer`.
Refresh tokens are opaque random strings; only their digest is stored, and each
one dies the moment it is used. Presenting an already-spent refresh token is
treated as theft: every session on that account is signed out. Changing a
password does the same, then hands back a fresh pair.

Progress is derived, not stored. `GET /api/progress` and `GET /api/dashboard`
recompute stats, mastery, skill axes and the next step from the raw rows on every
call, so there is no summary to fall out of sync. Badges are the one exception —
finishing every lesson and lab in a module writes an `earned_badges` row, and
that write is idempotent.

Grading and progress are joined at `/api/grade`: send `challenge_slug` with a
token and the attempt is recorded and any newly earned badge comes back on the
response. Without a token the endpoint grades and returns exactly as before.

## The sandbox is not a security boundary

`/api/introspect` runs learner code with `exec()`. The defences are real but they
are defence in depth, not containment:

- a fresh `spawn` process per request, so a crash cannot take the API with it
- a hard 5-second kill, timed to start after the child signals ready, so import
  cost is not charged to the learner's budget
- `__builtins__` cut down, and `__import__` limited to a whitelist — cmath,
  collections, fractions, functools, itertools, math, numpy, operator, qiskit,
  random, statistics, typing

`import os` returns an `ImportError` that names the whitelist. That stops
accidents and casual pokes. It does not stop a determined attacker: CPython
introspection has too many routes back to the interpreter. **Run this on
localhost or behind an authenticated gateway, in a container you are willing to
lose. Do not expose `/api/introspect` to the open internet.**

## Layout

```
app/
  main.py                    app, CORS, error handlers, /api/health
  core/config.py             env-backed settings
  models/
    circuit_ir.py            the IR, gate table and validation
    api.py                   request and response models
  services/
    adapters/
      base.py                build_circuit / simulate contract
      qiskit_adapter.py      AerSimulator
      cirq_adapter.py        native Cirq
      pennylane_adapter.py   native PennyLane
      qbraid_adapter.py      stub
      factory.py             get_adapter, aliases, install probe
    grader.py                fidelity, unitary equivalence, hints
    sandbox.py               exec in a killed child, DAG to IR
    tutor.py                 circuit digest, prompts, offline answer
  api/routes/
    execute.py               /simulate /grade /introspect /backends
    tutor.py                 /tutor/ask /tutor/explain /tutor/status
    auth.py                  /auth/register /login /refresh /logout /me
    progress.py              /catalog /progress /dashboard
  api/deps.py                bearer parsing, current_user, db session
  core/clock.py              naive-UTC helpers used by every timestamp
  core/curriculum.py         modules, lessons, labs, badges, mastery ladder
  core/security.py           bcrypt, JWT mint and verify, refresh hashing
  db/models.py               users, auth_sessions, lesson_completions,
                             exercise_attempts, earned_badges
  db/session.py              engine, session factory, create_all
  models/auth.py             account request and response models
  models/progress.py         progress and dashboard response models
  services/accounts.py       registration, login, session rotation
  services/progress.py       the snapshot the dashboard is built from
```

MIT licensed, like the rest of the repository.
