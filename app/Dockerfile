FROM python:3.12

RUN pip install poetry==1.8.3

WORKDIR /app

COPY pyproject.toml poetry.lock ./

COPY ./app/src /app/src
COPY ./core /app/core

RUN poetry install

CMD ["poetry", "run", "fastapi", "run", "src/main.py"]
