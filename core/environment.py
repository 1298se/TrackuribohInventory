from enum import Enum
import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

class Env(str, Enum):
    DEBUG = "DEBUG"
    PROD = "PROD"

class Environment(BaseSettings):
    env: Env
    db_username: str
    db_password: str
    db_endpoint: str
    db_port: str

    tcgplayer_client_id: str
    tcgplayer_client_secret: str

    # We provide a fallback env_file so we can run the FastAPI app in Pycharm
    model_config = SettingsConfigDict(
        env_file=f"{Path(__file__).parent.parent}/.env",
        extra="allow",
    )

    @property
    def db_url(self):
        url = f'postgresql://{self.db_username}:{self.db_password}@{self.db_endpoint}:{self.db_port}'

        print(url)
        return url


@lru_cache
def get_environment():
    return Environment()
