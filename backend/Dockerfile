# The API cannot run on Vercel. Its dependency tree is ~790 MB installed —
# scipy, sympy, qiskit-aer, cirq and pennylane-lightning are all compiled —
# and Vercel's Python functions cap at 250 MB unzipped. Qiskit plus Aer alone
# is already over that, so trimming does not rescue it either. It needs a
# container, which is what this is.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

# Copied first so a code change does not reinstall 790 MB of wheels.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app

# Hosts hand the port over in $PORT and expect 0.0.0.0; the local default of
# 127.0.0.1:8000 would bind somewhere the platform's router cannot see.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
