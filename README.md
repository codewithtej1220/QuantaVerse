# QuantaVerse

A free, open educational resource for quantum computing: eight modules from the
qubit to Shor's algorithm, a drag-and-drop circuit sandbox with real Qiskit
behind it, graded circuit labs, an AI tutor, and a student record that tracks
what you have finished.

## Two services

The repository holds a Next.js site and a Python API. They are separate
processes and talk over HTTP.

```
Next.js  :3000  ──▶  FastAPI  :8000  ──▶  database
  the site             accounts, progress, grading
                       Qiskit · Cirq · PennyLane
```

The site runs on its own — the sandbox has a statevector simulator in the
browser, so circuits still run with no API at all. Start the API when you want
real Qiskit behind the run button, a graded lab, the AI tutor, or an account
whose progress is saved.

## Prerequisites

- **Node 20 or newer** (developed on 24)
- **Python 3.11 or 3.12.** Qiskit, Cirq and PennyLane do not publish wheels for
  every newer release yet, so 3.13+ may fail to install.

## Setup

```bash
npm install
```

```bash
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt
```

On macOS or Linux the venv path is `backend/.venv/bin/pip`.

## Run

Two terminals.

```bash
npm run dev
```

```bash
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --reload
```

Then open http://localhost:3000. Check http://localhost:8000/api/health to
confirm the API is up and see which quantum frameworks it found.

## After a fresh clone

Everything above works with no configuration at all: circuits simulate in your
browser, and the API creates its own SQLite database on first run.

One thing is missing, because it cannot be committed — the tutor's model key.
Without it the tutor still answers, but from a Qiskit read-out rather than in
conversation. Two minutes gets you the full version:

```bash
cp backend/.env.example backend/.env
```

On Windows: `copy backend\.env.example backend\.env`.

Then open that file and paste a key into `OPENAI_API_KEY`. A free one from
console.groq.com takes about thirty seconds and needs no card — API Keys →
Create API Key. The provider URL and model name are already filled in for you,
so the key is the only thing to add.

Restart the API afterwards. Settings are read once at startup, so `--reload`
will not pick up a change to this file.

To confirm it worked, `http://localhost:8000/api/tutor/status` should report
`"live": true`. If it says `false`, the key did not load; if it says `true` but
answers stay terse, check `configured_model` in that same response against the
model list at your provider.

## Configuration

Both services read optional env files that are not in the repository, because
they hold secrets. Every value has a working default, so you can skip this
entirely for local development.

**`backend/.env`** — copy `backend/.env.example` and fill in what you need. The
one worth setting is the token signing key:

```bash
QUANTAVERSE_JWT_SECRET=any-long-random-string
```

Left empty, the API mints a random key on every boot. Signed-in students are not
kicked out when that happens — their refresh token still recovers the session —
but tokens stop being portable across restarts or across more than one API
instance.

Set `OPENAI_API_KEY` to make the tutor stream from a model. Without it the tutor
still answers, from its own analysis of the circuit on screen.

That key does not have to be OpenAI's, and paying for one is not part of running
this. The variable names come from the SDK, which is an HTTP client that talks to
whatever `OPENAI_BASE_URL` points at — Groq serves the same API on a free tier.
See `backend/README.md` for the three values, and note the model name has to
match whichever provider the key belongs to.

**`.env.local`** — only needed if the API is not on the default port:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Accounts and the database

Registration, login, lesson completion and lab scores all work out of the box.
On first boot the API creates its five tables automatically — there is no
migration step.

By default the database is a SQLite file at `backend/quantaverse.db`. It is
ignored by git, because it holds email addresses and password hashes. That means
**each machine keeps its own students**: clone the repo somewhere else and it
starts empty.

To share one record across devices, point the API at any Postgres instance —
a Supabase project works, and so does a local server. Nothing in the code
changes:

```bash
QUANTAVERSE_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/postgres
```

The tables are created on the next boot exactly as they are for SQLite.

## Layout

```
src/                    the Next.js site (App Router)
  app/                  routes: curriculum, sandbox, dashboard, login, register
  components/           UI, split by area
  lib/                  API client, auth, circuit IR, quantum maths
backend/                the FastAPI service
  app/api/routes/       simulate, grade, tutor, auth, progress
  app/services/         framework adapters, grader, sandbox, accounts, progress
  app/db/               SQLAlchemy models and session
```

`backend/README.md` documents every endpoint, the circuit IR and the account
model in detail.

MIT licensed. Curriculum content is CC BY-SA.
