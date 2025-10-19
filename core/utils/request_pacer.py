import asyncio
import logging
import random
import time


logger = logging.getLogger(__name__)


class RequestException(Exception):
    """Exception for carrying HTTP status codes in request processing."""

    def __init__(self, status_code: int, message: str = "", result=None):
        super().__init__(message)
        self.status_code = status_code
        self.result = result  # attach original result for debugging


class BurstRequestPacer:
    """Burst-mode request pacer with jitter and explicit cooldown handling.

    Provides paced bursts and adaptive cooldowns on rate limits.
    """

    def __init__(
        self,
        burst_size: int = 25,
        burst_duration_seconds: float = 10.0,
        burst_pause_seconds: float = 120.0,
    ):
        # Burst mode configuration
        self.initial_burst_size = burst_size
        self.current_burst_size = burst_size
        self.burst_duration_seconds = burst_duration_seconds
        self.burst_pause_seconds = burst_pause_seconds
        self.min_burst_size = 15

        # State tracking
        self.last_request_time = 0.0
        self._remaining_requests = 0
        self._burst_start_time = 0.0
        self._in_burst_pause = False
        self._burst_pause_start = 0.0
        self._current_burst_count = 0
        self._bursts_completed = 0
        self._consecutive_burst_failures = 0
        self._last_success_at = 0.0
        self._last_cooldown_seconds = 70.0

    async def create_schedule(self, total_requests: int):
        """
        Generate a schedule for requests, yielding when safe to make requests.

        Args:
            total_requests: Total number of requests to schedule

        Yields:
            Nothing - just indicates when it's safe to make a request
        """
        logger.info(
            f"Burst mode: {total_requests} requests in bursts of {self.current_burst_size}"
        )

        self._remaining_requests = total_requests

        while self._remaining_requests > 0:
            await self._wait_for_next_burst_slot()

            # Decrement remaining requests when we yield a slot
            self._remaining_requests -= 1

            yield

    async def _wait_for_next_burst_slot(self):
        """Wait until it's safe to make the next request in burst mode."""
        current_time = asyncio.get_event_loop().time()

        # Handle burst pause period
        if self._in_burst_pause:
            pause_elapsed = current_time - self._burst_pause_start
            if pause_elapsed < self.burst_pause_seconds:
                remaining_pause = self.burst_pause_seconds - pause_elapsed
                logger.debug(f"Burst pause: {remaining_pause:.1f}s remaining")
                await asyncio.sleep(remaining_pause)

            # End burst pause, start new burst
            self._in_burst_pause = False
            self._current_burst_count = 0
            self._burst_start_time = asyncio.get_event_loop().time()
            self._bursts_completed += 1
            logger.info(
                f"Starting burst {self._bursts_completed + 1} with {self.current_burst_size} requests"
            )

        # Check if we need to start first burst
        elif self._current_burst_count == 0 and self._burst_start_time == 0:
            self._burst_start_time = current_time
            logger.debug(
                f"Starting first burst with {self.current_burst_size} requests"
            )

        # Check if current burst is complete
        elif self._current_burst_count >= self.current_burst_size:
            # Successful burst completed: reset failure counter
            if self._consecutive_burst_failures > 0:
                logger.debug(
                    f"Burst completed successfully, resetting failure counter (was {self._consecutive_burst_failures})"
                )
                self._consecutive_burst_failures = 0

            # Start burst pause
            self._in_burst_pause = True
            self._burst_pause_start = current_time
            jitter_factor = 0.9 + random.random() * 0.2  # ±10% jitter on pause
            pause_duration = self.burst_pause_seconds * jitter_factor
            logger.info(
                f"Burst complete ({self.current_burst_size} requests). Pausing for {pause_duration:.1f}s"
            )
            await asyncio.sleep(pause_duration)

            # Start next burst
            self._in_burst_pause = False
            self._current_burst_count = 0
            self._burst_start_time = asyncio.get_event_loop().time()
            self._bursts_completed += 1
            logger.info(
                f"Starting burst {self._bursts_completed + 1} with {self.current_burst_size} requests"
            )

        # Within active burst - pace requests evenly across burst duration
        else:
            burst_elapsed = current_time - self._burst_start_time
            target_elapsed = (
                self._current_burst_count / self.current_burst_size
            ) * self.burst_duration_seconds

            if burst_elapsed < target_elapsed:
                sleep_time = target_elapsed - burst_elapsed
                await asyncio.sleep(sleep_time)

        self._current_burst_count += 1
        self.last_request_time = asyncio.get_event_loop().time()

    def on_rate_limited(self):
        """Record a rate limit signal and adapt burst parameters."""
        now = time.time()
        self._last_success_at = now

        # Reduce burst size and track failures
        self._consecutive_burst_failures += 1
        old_burst_size = self.current_burst_size

        if self._consecutive_burst_failures == 1:
            # First failure: reduce burst size by 5
            self.current_burst_size = max(
                self.min_burst_size, self.current_burst_size - 5
            )
        elif self._consecutive_burst_failures == 2:
            # Second failure: reduce to 20
            self.current_burst_size = max(self.min_burst_size, 20)
        elif self._consecutive_burst_failures >= 3:
            # Multiple failures: reduce to minimum
            self.current_burst_size = self.min_burst_size

        if old_burst_size != self.current_burst_size:
            logger.warning(
                f"Burst mode: reducing burst size from {old_burst_size} to {self.current_burst_size} due to rate limiting (failure {self._consecutive_burst_failures})"
            )
            # Increase pause duration slightly for next burst
            self.burst_pause_seconds = min(180.0, self.burst_pause_seconds * 1.1)

        # Increase next cooldown baseline exponentially with cap
        self._last_cooldown_seconds = min(600.0, self._last_cooldown_seconds * 1.5)

    async def cooldown(
        self,
        base_duration_seconds: float | None = None,
        add_retry_request: bool = False,
    ):
        """Wait for cooldown period after rate limiting or errors.

        Args:
            base_duration_seconds: Base cooldown; jitter is always applied. If None, uses adaptive baseline.
            add_retry_request: If True, adds one more request to the current schedule.
        """
        # Pick baseline: adaptive if not provided
        if base_duration_seconds is None:
            base = self._last_cooldown_seconds
        else:
            base = base_duration_seconds

        # Apply jitter (±20%) around the base duration
        jitter_factor = 0.8 + random.random() * 0.4
        duration_seconds = base * jitter_factor

        if add_retry_request:
            self._remaining_requests += 1

        logger.debug(
            f"Cooling down for {duration_seconds:.1f} seconds (base={base:.1f}, jitter={jitter_factor:.2f})"
        )
        await asyncio.sleep(duration_seconds)


class ConstantRatePacer:
    """Simple constant-rate request pacer.

    Paces requests at a fixed rate with no bursting or pauses.
    """

    def __init__(self, requests_per_second: float = 1.0):
        """Initialize the pacer.

        Args:
            requests_per_second: Target rate for requests (default: 1.0)
        """
        self.requests_per_second = requests_per_second
        self.seconds_per_request = 1.0 / requests_per_second
        self.last_request_time = 0.0

    async def create_schedule(self, total_requests: int):
        """Generate a schedule for requests at a constant rate.

        Args:
            total_requests: Total number of requests to schedule

        Yields:
            Nothing - just indicates when it's safe to make a request
        """
        logger.info(
            f"Constant rate mode: {total_requests} requests at {self.requests_per_second} req/s"
        )

        for _ in range(total_requests):
            current_time = asyncio.get_event_loop().time()

            if self.last_request_time > 0:
                elapsed = current_time - self.last_request_time
                sleep_time = self.seconds_per_request - elapsed

                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

            self.last_request_time = asyncio.get_event_loop().time()
            yield
