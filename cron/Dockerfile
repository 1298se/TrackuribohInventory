FROM python:3.12-slim-bullseye

# Install Playwright and Chromium (with OS deps), and uv
RUN pip install --no-cache-dir playwright uv \
  && python -m playwright install --with-deps chromium

WORKDIR /code

# Copy dependency definition and lock file first for caching
COPY pyproject.toml uv.lock ./

# Copy application code
COPY ./cron /code/cron
COPY ./core /code/core

# Install dependencies from the lock file
RUN uv pip sync uv.lock --system

# Default CMD changed to bash for easier interactive debugging.
# ECS task definitions explicitly override the command to run specific tasks.
CMD ["bash"]
