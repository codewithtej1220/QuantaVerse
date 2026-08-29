# Deploying QuantaVerse

The site goes on Vercel. The API cannot, and this explains why and where it
goes instead.

## Why the API is not on Vercel

Vercel's Python runtime is a serverless function capped at **250 MB unzipped**.
The API's dependencies come to **~790 MB installed**:

| Package | Installed |
| --- | --- |
| scipy | 113 MB |
| sympy | 72 MB |
| qiskit-aer | 40 MB |
| qiskit | 34 MB |
| pennylane-lightning | 34 MB |
| numpy | 33 MB |
| pennylane | 23 MB |
| cirq (+ vendor plugins) | ~15 MB |

Qiskit and Aer *on their own* are already over the limit once scipy, sympy and
numpy come with them, so dropping Cirq and PennyLane does not rescue it.

Two further blockers, in case the size one is ever solved: a serverless
filesystem is ephemeral, so a SQLite database resets on every cold start; and
importing Qiskit plus Aer takes several seconds, which a 10-second Hobby
function budget does not comfortably absorb before a 1,024-shot simulation has
even started.

So: **site on Vercel, API in a container.**

## 1. The site (Vercel)

Import the repository at vercel.com/new. It is a stock Next.js app at the repo
root and needs no build configuration — `.vercelignore` keeps `backend/` out of
the upload.

Set one environment variable:

```
NEXT_PUBLIC_API_URL = https://<your-api-host>
```

It is read at build time, so redeploy after changing it.

**The site works without the API.** The landing page, the curriculum, the
sandbox and the whole of `/lab` run entirely in the browser on the TypeScript
statevector simulator. Only four things need the API: sign-in, the dashboard's
live record, Qiskit-backed grading, and the AI tutor. Without it those show an
honest "cannot reach the API" state rather than breaking.

If you deploy the site alone, everything a judge is likely to click still works.

## 2. The API (Render, Railway or Fly)

`render.yaml` is a working blueprint — at render.com, New → Blueprint, point it
at this repo, and it provisions the web service and a Postgres database, wiring
`QUANTAVERSE_DATABASE_URL` between them and generating a JWT secret.

Railway and Fly.io both work too; `backend/Dockerfile` is what they need, and it
binds `0.0.0.0:$PORT` the way every platform router expects.

One caveat worth knowing before you pick a plan: Render's free tier gives
512 MB of RAM, and importing Qiskit, Aer, Cirq and PennyLane together sits
close to it. If the service restarts under load, either move up an instance
size or remove `cirq` and `pennylane` from `requirements.txt` — `/api/health`
reports whichever backends are installed and the engine picker follows it, so
removing them degrades cleanly instead of erroring.

## 3. Point them at each other

Order matters, because each needs the other's URL.

1. Deploy the API. Note its URL.
2. Set `NEXT_PUBLIC_API_URL` on Vercel to that URL and deploy the site.
3. Set `QUANTAVERSE_ALLOWED_ORIGINS` on the API to the Vercel URL and redeploy.

Step 3 is not optional in spirit: the default is `*`, which works but lets any
origin call the API with a bearer token.

## Environment variables

**Vercel**

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | for auth/dashboard/tutor | Defaults to `http://127.0.0.1:8000`, which is useless in production |

**API host**

| Name | Required | Notes |
| --- | --- | --- |
| `QUANTAVERSE_JWT_SECRET` | yes | Generate a fresh one. Do not reuse the local value in `backend/.env` |
| `QUANTAVERSE_DATABASE_URL` | yes | Postgres. SQLite on a container is wiped on every redeploy |
| `QUANTAVERSE_ALLOWED_ORIGINS` | yes | The Vercel URL |
| `OPENAI_API_KEY` | no | Without it the tutor uses its deterministic Qiskit read-out |
| `QUANTAVERSE_REGISTRATION_OPEN` | no | `1` by default |

## A note on secrets

`backend/.env` is gitignored and has never been committed — the secret in it is
a local development value. Generate a new one for production rather than
copying it, since it has existed in plaintext on a development machine.
