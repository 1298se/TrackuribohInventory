FROM ghcr.io/astral-sh/uv:0.8.22 AS uv

FROM python:3.12-slim-bullseye

# Install a pinned uv binary for reproducible builds
COPY --from=uv /uv /uvx /bin/

WORKDIR /code

ENV VIRTUAL_ENV=/code/.venv
ENV PATH="/code/.venv/bin:${PATH}"

# Copy dependency definition and lock file first for caching
COPY pyproject.toml uv.lock README.md ./

# Install only runtime dependencies to leverage Docker layer caching
RUN uv sync --locked --no-dev --no-install-project

# Copy application code
COPY ./cron /code/cron
COPY ./core /code/core

# Default CMD changed to bash for easier interactive debugging.
# ECS task definitions explicitly override the command to run specific tasks.
CMD ["bash"]
