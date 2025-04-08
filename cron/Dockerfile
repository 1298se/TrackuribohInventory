FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /code

COPY requirements.txt requirements-lock.txt ./

COPY ./cron /code/cron
COPY ./core /code/core

RUN uv pip install --system -r requirements.txt

# Default CMD changed to bash for easier interactive debugging.
# ECS task definitions explicitly override the command to run specific tasks.
CMD ["bash"]
