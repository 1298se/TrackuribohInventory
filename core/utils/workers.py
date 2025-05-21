import asyncio
from typing import Any


async def process_task_queue(queue: asyncio.Queue, num_workers: int = 10) -> list[Any]:
    worker_tasks = []

    for i in range(num_workers):
        worker_tasks.append(asyncio.create_task(_worker(queue, name=f"worker-{i}")))

    await queue.join()

    for task in worker_tasks:
        task.cancel()

    # Wait for cancellation to finish, collecting results
    raw_results = await asyncio.gather(*worker_tasks, return_exceptions=True)
    # Propagate any non-cancellation exceptions
    errors = [
        r
        for r in raw_results
        if isinstance(r, Exception) and not isinstance(r, asyncio.CancelledError)
    ]
    if errors:
        raise errors

    # Flatten the results lists from each worker
    flat_results: list[Any] = []

    for r in raw_results:
        flat_results.extend(r)

    return flat_results


async def _worker(queue, name=None):
    results: list[Any] = []
    try:
        while True:
            # Get a "work item" out of the queue.
            task = await queue.get()
            try:
                result = await task
                results.append(result)
            finally:
                queue.task_done()
    except asyncio.CancelledError:
        # Worker was cancelled, return all collected results
        return results
