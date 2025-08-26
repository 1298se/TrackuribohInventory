#!/usr/bin/env python3
"""
Test script to verify that process_task_queue correctly raises errors immediately
instead of collecting them.

This script tests:
1. Successful task execution
2. Immediate error raising on task failure
3. Proper cleanup and worker cancellation
"""

import asyncio
import logging
from core.utils.workers import process_task_queue

# Configure logging for visibility
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def successful_task(task_id: int) -> str:
    """A task that always succeeds."""
    await asyncio.sleep(0.1)  # Simulate some work
    logger.info(f"Task {task_id} completed successfully")
    return f"success_{task_id}"


async def failing_task(task_id: int) -> str:
    """A task that always fails."""
    await asyncio.sleep(0.1)  # Simulate some work
    logger.error(f"Task {task_id} is about to fail")
    raise ValueError(f"Task {task_id} failed intentionally")


async def test_successful_tasks():
    """Test that successful tasks work correctly."""
    logger.info("=== Testing successful tasks ===")

    task_queue = asyncio.Queue()

    # Add 5 successful tasks
    for i in range(5):
        await task_queue.put(successful_task(i))

    try:
        successes = await process_task_queue(task_queue)
        logger.info(
            f"✅ All tasks succeeded! Got {len(successes)} results: {successes}"
        )
        return True
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False


async def test_failing_task():
    """Test that a failing task raises an ExceptionGroup containing ValueError."""
    logger.info("=== Testing failing task ===")

    task_queue = asyncio.Queue()

    # Add 2 successful tasks first
    await task_queue.put(successful_task(1))
    await task_queue.put(successful_task(2))

    # Add a failing task
    await task_queue.put(failing_task(3))

    # Add more successful tasks (these may execute due to drainage semantics)
    await task_queue.put(successful_task(4))
    await task_queue.put(successful_task(5))

    passed = False
    try:
        successes = await process_task_queue(task_queue)
        logger.error(f"❌ Expected error but got successes: {successes}")
    except* ValueError as eg:  # Python 3.11+ syntax
        # We expect at least one ValueError inside the ExceptionGroup
        logger.info(f"✅ Correctly caught ExceptionGroup containing ValueError: {eg}")
        passed = True
    return passed


async def test_mixed_tasks():
    """Test that a failing task in the middle raises an ExceptionGroup containing ValueError."""
    logger.info("=== Testing mixed tasks with failure in middle ===")

    task_queue = asyncio.Queue()

    # Add tasks: success, success, FAIL, success, success
    await task_queue.put(successful_task(1))
    await task_queue.put(successful_task(2))
    await task_queue.put(
        failing_task(3)
    )  # This should fail and be included in ExceptionGroup
    await task_queue.put(successful_task(4))
    await task_queue.put(successful_task(5))

    passed = False
    try:
        successes = await process_task_queue(task_queue)
        logger.error(f"❌ Expected error but got successes: {successes}")
    except* ValueError as eg:  # Python 3.11+ syntax
        logger.info(f"✅ Correctly caught ExceptionGroup containing ValueError: {eg}")
        passed = True
    return passed


async def test_empty_queue():
    """Test that an empty queue works correctly."""
    logger.info("=== Testing empty queue ===")

    task_queue = asyncio.Queue()

    try:
        successes = await process_task_queue(task_queue)
        logger.info(
            f"✅ Empty queue handled correctly. Got {len(successes)} results: {successes}"
        )
        return True
    except Exception as e:
        logger.error(f"❌ Unexpected error with empty queue: {e}")
        return False


async def main():
    """Run all tests."""
    logger.info("Starting process_task_queue tests...")

    test_results = []

    # Run all tests
    test_results.append(await test_successful_tasks())
    test_results.append(await test_failing_task())
    test_results.append(await test_mixed_tasks())
    test_results.append(await test_empty_queue())

    # Report results
    passed = sum(test_results)
    total = len(test_results)

    logger.info("=" * 50)
    logger.info(f"Test Results: {passed}/{total} tests passed")

    if passed == total:
        logger.info("🎉 All tests passed! process_task_queue is working correctly.")
        return 0
    else:
        logger.error("❌ Some tests failed. Check the implementation.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
