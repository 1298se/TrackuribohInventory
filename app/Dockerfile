FROM python:3.12

RUN pip install poetry==1.8.3

WORKDIR /code

COPY pyproject.toml poetry.lock ./

COPY ./app /code/app
COPY ./core /code/core

RUN poetry install

CMD ["poetry", "run", "fastapi", "run", "app/main.py"]
