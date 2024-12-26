import asyncio
from asyncio import Task
from typing import Coroutine


def create_workers(count: int, queue) -> list[Task]:
    return [asyncio.create_task(worker(queue, name=f"worker-{i}")) for i in range(count)]


async def worker(queue, name=None):
    while True:
        # Get a "work item" out of the queue.
        task = await queue.get()

        # Sleep for the "sleep_for" seconds.
        await task

        # Notify the queue that the "work item" has been processed.
        queue.task_done()

        print(f'{name} has completed task')

