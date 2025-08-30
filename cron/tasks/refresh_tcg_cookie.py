import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

import boto3
from playwright.async_api import async_playwright

from core.environment import get_environment
from cron.telemetry import init_sentry

init_sentry("refresh_tcg_cookie")

TARGET_URL = "https://www.tcgplayer.com/product/593324?Language=English"

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def _load_seed_cookie_from_secret(secret_id: str, region: str) -> str:
    session = boto3.session.Session(region_name=region)
    client = session.client("secretsmanager")
    resp = client.get_secret_value(SecretId=secret_id)
    secret_string = resp.get("SecretString") or ""
    if not secret_string:
        raise ValueError(f"Secret {secret_id} has no SecretString")

    # Parse JSON and return TCGPLAYER_COOKIE key
    data = json.loads(secret_string)
    return data["TCGPLAYER_COOKIE"]


def _parse_cookie_header(cookie_header: str) -> list[dict]:
    cookies: list[dict] = []
    parts = [p.strip() for p in cookie_header.split(";") if p.strip()]
    for part in parts:
        if "=" not in part:
            continue
        name, value = part.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        cookies.append(
            {"name": name, "value": value, "domain": ".tcgplayer.com", "path": "/"}
        )
        cookies.append(
            {"name": name, "value": value, "domain": "www.tcgplayer.com", "path": "/"}
        )
    return cookies


async def refresh_cookie_with_seed() -> Optional[tuple[str, bool]]:
    """Use seeded Cookie header to open a logged-in page and (optionally) get a refreshed auth cookie.

    Returns (cookie_header, changed_flag) or None on failure.
    """
    env = get_environment()
    secret_id = env.tcgplayer_cookie_secret_name

    seed_cookie = _load_seed_cookie_from_secret(secret_id, env.aws_region)

    old_auth_match = re.search(r"TCGAuthTicket_Production=([^;]+)", seed_cookie)
    old_auth = old_auth_match.group(1) if old_auth_match else ""

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
        )

        context = await browser.new_context(
            viewport={"width": 1280, "height": 800}, device_scale_factor=1
        )
        page = await context.new_page()

        await context.add_cookies(_parse_cookie_header(seed_cookie))

        await page.goto(TARGET_URL, wait_until="domcontentloaded")

        # Verify email appears somewhere in DOM (simple contains or text locator)
        email = env.tcgplayer_email
        try:
            await page.locator(f"text={email}").first.wait_for(
                state="visible", timeout=15000
            )
        except Exception:
            html = await page.content()
            if email not in html:
                logger.error(
                    "Email not found on product page; session may not be authenticated.",
                )
                return None

        # Read cookies and build new header
        jar = await context.cookies()
        cookie_map = {c["name"]: c["value"] for c in jar}
        new_auth = cookie_map.get("TCGAuthTicket_Production")
        visitor = cookie_map.get("TCG_VisitorKey")

        parts: list[str] = []
        if new_auth:
            parts.append(f"TCGAuthTicket_Production={new_auth}")
        if visitor:
            parts.append(f"TCG_VisitorKey={visitor}")
        new_header = "; ".join(parts) if parts else seed_cookie

        await browser.close()
        return new_header, (new_auth is not None and old_auth != new_auth)


def store_cookie_in_secrets_manager(cookie_value: str) -> None:
    env = get_environment()
    secret_id = env.tcgplayer_cookie_secret_name

    session = boto3.session.Session(region_name=env.aws_region)
    client = session.client("secretsmanager")

    resp = client.get_secret_value(SecretId=secret_id)
    existing = resp.get("SecretString") or "{}"
    data = json.loads(existing)

    data["TCGPLAYER_COOKIE"] = cookie_value
    data["TCGPLAYER_COOKIE_LAST_REFRESHED"] = datetime.now(timezone.utc).isoformat()

    client.put_secret_value(SecretId=secret_id, SecretString=json.dumps(data))
    logger.info(
        f"Updated TCG session secret at {data['TCGPLAYER_COOKIE_LAST_REFRESHED']}"
    )


async def main() -> None:
    result = await refresh_cookie_with_seed()
    if not result:
        logger.error("Cookie refresh/validation failed.")
        return

    cookie, changed = result

    if changed:
        store_cookie_in_secrets_manager(cookie)
    else:
        logger.info("TCG session secret unchanged; not updating.")


if __name__ == "__main__":
    asyncio.run(main())
