import asyncio
from typing import Any


async def process_task_queue(
    queue: asyncio.Queue, num_workers: int = 10
) -> tuple[list[Any], list[Exception]]:
    worker_tasks = []

    for i in range(num_workers):
        worker_tasks.append(asyncio.create_task(_worker(queue, name=f"worker-{i}")))

    await queue.join()

    for task in worker_tasks:
        task.cancel()

    # Wait for cancellation to finish, collecting per-worker successes and failures
    raw_results = await asyncio.gather(*worker_tasks, return_exceptions=True)
    successes: list[Any] = []
    failures: list[Exception] = []
    for res in raw_results:
        if isinstance(res, asyncio.CancelledError):
            # Worker was cancelled, this is an expected part of shutdown for this function.
            # The _worker function itself will return its (successes, failures) tuple.
            # If gather returns CancelledError directly, it means the worker didn't even get to its return statement.
            pass
        elif isinstance(res, Exception):
            # Other unexpected exception from the worker task itself (should be rare if _worker catches all internal task exceptions)
            failures.append(res)
        else:
            # Expected tuple of (worker_successes, worker_failures)
            worker_successes, worker_failures = res
            successes.extend(worker_successes)
            failures.extend(worker_failures)
    return successes, failures


async def _worker(queue, name=None):
    successes: list[Any] = []
    failures: list[Exception] = []
    try:
        while True:
            coro = await queue.get()
            try:
                result = await coro
                successes.append(result)
            except Exception as exc:
                # Log the exception and record failure
                print(f"[{name}] task failed: {exc!r}")
                failures.append(exc)
            finally:
                queue.task_done()
    except asyncio.CancelledError:
        # Worker was cancelled, return both successes and failures
        return successes, failures
