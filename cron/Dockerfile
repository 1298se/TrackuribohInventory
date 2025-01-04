FROM python:3.12

RUN pip install poetry==1.8.3

WORKDIR /code

COPY pyproject.toml poetry.lock ./

COPY ./cron /code/cron
COPY ./core /code/core

RUN poetry install

# Use -m cron.scheduler instead of cron/scheduler.py because
# it will auto include current working directly on import path
CMD ["poetry", "run", "python", "-m", "cron.scheduler"]
