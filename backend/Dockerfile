FROM python:3.12-slim

WORKDIR /app

# uv manages the venv from pyproject.toml + uv.lock
RUN pip install --no-cache-dir uv

# Install dependencies (incl. the agent extra so the same image can run either
# the API or the LiveKit worker). --frozen uses the committed uv.lock as-is.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --extra agent

COPY app/ app/
COPY agent/ agent/
COPY scripts/ scripts/

# Put the venv on PATH so `uvicorn ...` (api) and `python -m agent.agent ...`
# (agent service, via the compose command override) both use it.
ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
