"""Configuração lida só de variáveis de ambiente (nunca valores no código)."""
import os
from dataclasses import dataclass


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_key: str
    worker_token: str
    shopee_app_id: str
    shopee_app_secret: str
    shopee_api_url: str
    shopee_conversions_days: int
    shopee_conversions_interval_min: int
    shopee_default_store_slug: str
    telegram_bot_token: str
    telegram_interval_sec: int
    telegram_max_delay_min: int
    telegram_max_attempts: int
    run_scheduler: bool

    @staticmethod
    def load() -> "Settings":
        return Settings(
            supabase_url=_env("SUPABASE_URL").rstrip("/"),
            supabase_service_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
            worker_token=_env("WORKER_TOKEN"),
            shopee_app_id=_env("SHOPEE_APP_ID"),
            shopee_app_secret=_env("SHOPEE_APP_SECRET"),
            shopee_api_url=_env("SHOPEE_API_URL", "https://open-api.affiliate.shopee.com.br/graphql"),
            shopee_conversions_days=_int("SHOPEE_CONVERSIONS_DAYS", 30),
            shopee_conversions_interval_min=_int("SHOPEE_CONVERSIONS_INTERVAL_MIN", 120),
            shopee_default_store_slug=_env("SHOPEE_DEFAULT_STORE_SLUG"),
            telegram_bot_token=_env("TELEGRAM_BOT_TOKEN"),
            telegram_interval_sec=_int("TELEGRAM_INTERVAL_SEC", 60),
            telegram_max_delay_min=_int("TELEGRAM_MAX_DELAY_MIN", 180),
            telegram_max_attempts=_int("TELEGRAM_MAX_ATTEMPTS", 3),
            run_scheduler=_env("RUN_SCHEDULER", "true").lower() in ("1", "true", "yes"),
        )

    def require(self, *names: str) -> None:
        missing = [_ENV_NAME.get(n, n.upper()) for n in names if not getattr(self, n)]
        if missing:
            raise RuntimeError("Variáveis de ambiente ausentes: " + ", ".join(missing))


_ENV_NAME = {"supabase_service_key": "SUPABASE_SERVICE_ROLE_KEY"}
