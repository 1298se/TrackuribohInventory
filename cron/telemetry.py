import os
import logging

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration


def init_sentry(task_name: str | None = None) -> None:
    """Initialize Sentry for cron tasks if SENTRY_DSN is provided.

    - Captures ERROR-level log records as Sentry events
    - Records WARNING+ logs as breadcrumbs (excludes INFO)
    - Leaves Sentry disabled if DSN is not set
    """
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        # Sentry not configured; do nothing
        return

    # Configure Sentry with logging integration
    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
        ],
        send_default_pii=False,
    )

    if task_name:
        with sentry_sdk.configure_scope() as scope:
            scope.set_tag("task", task_name)
