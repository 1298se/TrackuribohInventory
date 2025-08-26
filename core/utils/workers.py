import asyncio
from typing import Any


async def process_task_queue(queue: asyncio.Queue, num_workers: int = 10) -> list[Any]:
    worker_tasks = []

    for i in range(num_workers):
        worker_tasks.append(asyncio.create_task(_worker(queue, name=f"worker-{i}")))

    await queue.join()

    for task in worker_tasks:
        task.cancel()

    # Wait for cancellation to finish, collecting per-worker successes
    # Use return_exceptions=True to handle CancelledError gracefully
    raw_results = await asyncio.gather(*worker_tasks, return_exceptions=True)
    successes: list[Any] = []
    exceptions: list[BaseException] = []

    for res in raw_results:
        if isinstance(res, asyncio.CancelledError):
            # Worker was cancelled, this is expected during shutdown
            continue
        elif isinstance(res, Exception):
            # Worker encountered an exception
            exceptions.append(res)
        else:
            # Expected list of worker successes from _worker
            successes.extend(res)

    if exceptions:
        raise ExceptionGroup("process_task_queue failures", exceptions)

    return successes


async def _worker(queue, name=None):
    successes: list[Any] = []
    try:
        while True:
            coro = await queue.get()
            try:
                result = await coro
                successes.append(result)
            except Exception as exc:
                # Log the exception and immediately re-raise it to stop processing
                print(f"[{name}] task failed: {exc!r}")
                raise exc
            finally:
                queue.task_done()
    except asyncio.CancelledError:
        # Worker was cancelled, return successes accumulated so far
        return successes
