import json
from enum import Enum
from functools import lru_cache
from pathlib import Path

import boto3
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

    # TCGplayer login (for cookie refresh task)
    tcgplayer_email: str
    tcgplayer_password: str

    # Optional: browser session cookie and feature param for TCGplayer web API
    tcgplayer_cookie: str | None = None

    # AWS Secrets Manager integration to pull/store cookie in dev/prod
    aws_region: str
    tcgplayer_cookie_secret_name: (
        str  # Secret may contain TCGPLAYER_COOKIE key or raw string
    )
    tcgplayer_storage_state_secret_name: str | None = (
        None  # JSON storage state for session refresh
    )

    # Supabase configuration for authentication
    supabase_url: str  # Required: Supabase project URL
    supabase_anon_key: str  # Public anon key for auth flows

    # Security configuration
    cors_origins: list[str] = ["http://localhost:3000", "https://localhost:3000"]

    # We provide a fallback env_file so we can run the FastAPI app in Pycharm
    model_config = SettingsConfigDict(
        env_file=f"{Path(__file__).parent.parent}/.env",
        extra="allow",
    )

    @property
    def db_url(self):
        url = f"postgresql://{self.db_username}:{self.db_password}@{self.db_endpoint}:{self.db_port}"

        print(url)
        return url

    def get_tcgplayer_cookie(self) -> str | None:
        """Return cookie from env var, or fall back to AWS Secrets Manager if configured."""
        if self.tcgplayer_cookie:
            return self.tcgplayer_cookie

        session = boto3.session.Session(region_name=self.aws_region)
        client = session.client("secretsmanager")
        resp = client.get_secret_value(SecretId=self.tcgplayer_cookie_secret_name)
        secret_string = resp.get("SecretString")
        if not secret_string:
            raise ValueError(
                f"Secret {self.tcgplayer_cookie_secret_name} has no SecretString"
            )

        # Parse JSON and return TCGPLAYER_COOKIE key
        data = json.loads(secret_string)
        return data["TCGPLAYER_COOKIE"]


@lru_cache
def get_environment():
    return Environment()
