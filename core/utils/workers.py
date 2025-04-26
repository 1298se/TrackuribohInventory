import asyncio


async def process_task_queue(queue: asyncio.Queue, num_workers: int):
    worker_tasks = []

    for i in range(num_workers):
        worker_tasks.append(asyncio.create_task(_worker(queue, name=f"worker-{i}")))

    await queue.join()

    for task in worker_tasks:
        task.cancel()

    await asyncio.gather(*worker_tasks, return_exceptions=True)


async def _worker(queue, name=None):
    while True:
        # Get a "work item" out of the queue.
        task = await queue.get()

        # Sleep for the "sleep_for" seconds.
        await task

        # Notify the queue that the "work item" has been processed.
        queue.task_done()

        print(f"{name} has completed task")
