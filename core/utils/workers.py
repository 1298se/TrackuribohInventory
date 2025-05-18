import asyncio


async def process_task_queue(queue: asyncio.Queue, num_workers: int):
    worker_tasks = []

    for i in range(num_workers):
        worker_tasks.append(asyncio.create_task(_worker(queue, name=f"worker-{i}")))

    await queue.join()

    for task in worker_tasks:
        task.cancel()

    # Wait for cancellation to finish, collecting results
    results = await asyncio.gather(*worker_tasks, return_exceptions=True)
    # Propagate any non-cancellation exceptions
    errors = [r for r in results if isinstance(r, Exception)]
    if errors:
        raise errors[0]


async def _worker(queue, name=None):
    while True:
        # Get a "work item" out of the queue.
        task = await queue.get()

        try:
            await task
        finally:
            queue.task_done()
