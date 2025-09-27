FROM python:3.12-slim-bullseye

# Install uv (Python package manager)
RUN pip install --no-cache-dir uv

WORKDIR /code

# Copy dependency definition and lock file first for caching
COPY pyproject.toml uv.lock ./

# Install dependencies from the lock file
RUN uv pip sync uv.lock --system

# Copy application code
COPY ./cron /code/cron
COPY ./core /code/core

# Default CMD changed to bash for easier interactive debugging.
# ECS task definitions explicitly override the command to run specific tasks.
CMD ["bash"]
