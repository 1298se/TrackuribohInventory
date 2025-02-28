FROM python:3.12-slim AS builder

# Install poetry and configure it for faster installation
RUN pip install --no-cache-dir poetry==1.8.3 \
    && poetry config virtualenvs.create false

WORKDIR /code

# Copy only dependency files first to leverage Docker layer caching
COPY pyproject.toml poetry.lock ./

# Install dependencies only (without copying the application code)
# This layer will be cached as long as the dependencies don't change
RUN poetry install

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
CMD ["fastapi", "run", "app/main.py"]