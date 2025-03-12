FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /code

COPY requirements.txt requirements-lock.txt ./

COPY ./cron /code/cron
COPY ./core /code/core

RUN uv pip install --system -r requirements.txt

# Use -m cron.scheduler instead of cron/scheduler.py because
# it will auto include current working directly on import path
CMD ["python", "-m", "cron.scheduler"]
