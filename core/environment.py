import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(BaseSettings):
    db_username: str
    db_password: str
    db_endpoint: str
    db_port: str

    tcgplayer_client_id: str
    tcgplayer_client_secret: str

    model_config = SettingsConfigDict()

    @property
    def db_url(self):
        url = f'postgresql://{self.db_username}:{self.db_password}@{self.db_endpoint}:{self.db_port}'

        print(url)
        return url


@lru_cache
def get_environment():
    return Environment()
