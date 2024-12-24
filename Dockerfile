FROM python:3.12

RUN pip install poetry==1.8.3

WORKDIR /code

COPY pyproject.toml poetry.lock ./

COPY ./app /code/app

RUN poetry install

ENTRYPOINT ["poetry", "run", "python", "-m", "uvicorn", "app.main:app"]
