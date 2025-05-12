import json
from core.database import SessionLocal
from core.dao.transaction import create_transaction_with_line_items
from scripts.common.order_utils import parse_purchase_order


def import_purchase_orders(json_file_path: str, start_order_id: str = None) -> None:
    """
    Import purchase orders from a JSON file into the database.

    Args:
        json_file_path: Path to the JSON file containing purchase orders
        start_order_id: If provided, skip orders until this vendor ID is found, then start importing
    """
    with open(json_file_path, "r") as f:
        orders = json.load(f)

    successful_imports = 0
    skipped_orders = 0
    found_start_id = (
        start_order_id is None
    )  # If no start_order_id provided, start from beginning

    # Process orders in chunks of 10
    chunk_size = 10
    total_orders = len(orders)

    # Filter orders if start_order_id is provided
    if start_order_id and not found_start_id:
        print(f"Looking for start order ID: {start_order_id}")
        # Find the index of the order with the given vendor ID
        start_index = None
        for i, order in enumerate(orders):
            if order.get("vendorId") == start_order_id:
                start_index = i
                found_start_id = True
                print(
                    f"Found start order ID at position {start_index + 1} of {total_orders}"
                )
                break

        if not found_start_id:
            print(f"Error: Start order ID {start_order_id} not found in the JSON file")
            return

        # Remove all orders before the start order
        orders = orders[start_index:]
        total_orders = len(orders)

    for i in range(0, total_orders, chunk_size):
        chunk_end = min(i + chunk_size, total_orders)
        current_chunk = orders[i:chunk_end]

        print(f"\nProcessing orders {i + 1} to {chunk_end} of {total_orders}...")

        # Create a new session for each chunk
        session = SessionLocal()
        try:
            for order in current_chunk:
                try:
                    # Start a transaction for each order
                    with session.begin():
                        # Use shared parser to get transaction data and line items
                        tx_data, line_items_data = parse_purchase_order(session, order)
                        if not tx_data or not line_items_data:
                            skipped_orders += 1
                            continue

                        # Create transaction with line items
                        create_transaction_with_line_items(
                            session, tx_data, line_items_data
                        )
                        successful_imports += 1
                        print(f"Successfully imported order {order.get('vendorId')}")

                except Exception as e:
                    print(f"Error importing order {order.get('vendorId')}: {e}")
                    continue

        finally:
            # Close the session after processing the chunk
            session.close()

        # Show current progress
        print(
            f"\nProgress: {successful_imports} orders imported, {skipped_orders} orders skipped"
        )

        # Wait for user input if not at the end
        if chunk_end < total_orders:
            user_input = input(
                "\nPress Enter to continue with the next chunk, or type 'quit' to stop: "
            )
            if user_input.lower() == "quit":
                print("Import process stopped by user.")
                break

    print(
        f"\nImport complete: {successful_imports} orders imported, {skipped_orders} orders skipped"
    )


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print(
            "Usage: python import_purchase_orders.py <json_file_path> [start_order_id]"
        )
        sys.exit(1)

    json_file_path = sys.argv[1]
    start_order_id = sys.argv[2] if len(sys.argv) == 3 else None

    import_purchase_orders(json_file_path, start_order_id)
