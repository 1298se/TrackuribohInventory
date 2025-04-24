FROM python:3.12-slim AS builder

# Install uv for fast dependency installation
RUN pip install --no-cache-dir uv

WORKDIR /code

# Copy dependency definition and lock file first to leverage Docker layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies using the lock file
# This layer will be cached as long as the dependencies don't change
RUN uv pip sync uv.lock --system

# Final stage - uses a slim image for the runtime
FROM python:3.12-slim

WORKDIR /code

# Copy installed Python packages from builder stage
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY ./app /code/app
COPY ./core /code/core

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]