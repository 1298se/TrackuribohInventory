FROM public.ecr.aws/lambda/python:3.12

RUN pip install poetry==1.8.3

# 2. Disable Poetry's virtual env creation
RUN poetry config virtualenvs.create false

WORKDIR ${LAMBDA_TASK_ROOT}

COPY pyproject.toml poetry.lock ./

COPY ./cron/src ${LAMBDA_TASK_ROOT}/src
COPY ./core ${LAMBDA_TASK_ROOT}/core

RUN poetry install

CMD ["src.handler.handler"]
