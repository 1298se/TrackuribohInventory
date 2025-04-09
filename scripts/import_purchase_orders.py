import json
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
import pytz  # Add pytz for timezone handling

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models import (
    Product, Condition, Printing, Language, SKU, 
    Transaction, LineItem, TransactionType
)
from core.dao.transaction import (
    create_transaction_with_line_items,
    TransactionDataDict,
    LineItemDataDict
)


def find_product_by_tcgplayer_id(session: Session, tcgplayer_id: str) -> Optional[Product]:
    """Find a product by its TCGPlayer ID."""
    return session.scalar(
        select(Product).where(Product.tcgplayer_id == int(tcgplayer_id))
    )


def find_condition_by_name(session: Session, name: str) -> Optional[Condition]:
    """Find a condition by its name."""
    # Normalize condition name for matching (e.g., "near mint" -> "Near Mint")
    normalized_name = " ".join(word.capitalize() for word in name.split())
    return session.scalar(
        select(Condition).where(Condition.name == normalized_name)
    )


def find_printing_by_name(session: Session, name: str) -> Optional[Printing]:
    """Find a printing by its name."""
    # Normalize printing name for matching (e.g., "1st edition" -> "1st Edition")
    normalized_name = " ".join(word.capitalize() for word in name.split())
    return session.scalar(
        select(Printing).where(Printing.name == normalized_name)
    )


def find_sku(
    session: Session, product: Product, 
    condition: Condition, printing: Printing
) -> Optional[SKU]:
    """Find a SKU by product, condition, and printing."""
    return session.scalar(
        select(SKU).where(
            SKU.product_id == product.id,
            SKU.condition_id == condition.id,
            SKU.printing_id == printing.id
        )
    )


def import_purchase_orders(json_file_path: str, start_order_id: str = None) -> None:
    """
    Import purchase orders from a JSON file into the database.
    
    Args:
        json_file_path: Path to the JSON file containing purchase orders
        start_order_id: If provided, skip orders until this vendor ID is found, then start importing
    """
    with open(json_file_path, 'r') as f:
        orders = json.load(f)
    
    successful_imports = 0
    skipped_orders = 0
    found_start_id = start_order_id is None  # If no start_order_id provided, start from beginning
    
    # Process orders in chunks of 10
    chunk_size = 10
    total_orders = len(orders)
    
    # Filter orders if start_order_id is provided
    if start_order_id and not found_start_id:
        print(f"Looking for start order ID: {start_order_id}")
        # Find the index of the order with the given vendor ID
        start_index = None
        for i, order in enumerate(orders):
            if order.get('vendorId') == start_order_id:
                start_index = i
                found_start_id = True
                print(f"Found start order ID at position {start_index + 1} of {total_orders}")
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
        
        print(f"\nProcessing orders {i+1} to {chunk_end} of {total_orders}...")
        
        with SessionLocal() as session, session.begin():
            for order in current_chunk:
                try:
                    # Check if order was canceled (full refund)
                    is_canceled = order.get('shippingStatus', '').lower() == 'canceled'
                    
                    if is_canceled:
                        print(f"Skipping order {order.get('vendorId')}: Order was canceled (full refund)")
                        skipped_orders += 1
                        continue
                    
                    # Prepare transaction data
                    # Parse the date and set the EST timezone
                    naive_date = datetime.fromisoformat(order['orderedAt'])
                    eastern = pytz.timezone('US/Eastern')
                    transaction_date = eastern.localize(naive_date)
                    
                    shipping_cost = Decimal(str(order.get('shippingAmount', '0')))
                    tax_amount = Decimal(str(order.get('taxAmount', '0')))
                    currency = order.get('products', [{}])[0].get('currency', 'USD') if order.get('products') else 'USD'
                    vendor_id = order.get('vendorId', '')
                    
                    # Get the seller name from the first product (all products have the same seller)
                    seller_name = order.get('products', [{}])[0].get('seller', 'Unknown Seller') if order.get('products') else 'Unknown Seller'
                    
                    transaction_data: TransactionDataDict = {
                        'date': transaction_date,
                        'type': TransactionType.PURCHASE,
                        'counterparty_name': seller_name,
                        'comment': f"TCGPlayer order {vendor_id}",
                        'currency': currency,
                        'shipping_cost_amount': shipping_cost,
                        'tax_amount': tax_amount
                    }
                    
                    # Prepare line items data
                    line_items_data: List[LineItemDataDict] = []
                    valid_order = False
                    
                    for product_data in order.get('products', []):
                        product_tcgplayer_id = product_data.get('vendorId')
                        if not product_tcgplayer_id:
                            print(f"Skipping product in order {order.get('vendorId')}: No product ID")
                            continue
                        
                        # Find product
                        product = find_product_by_tcgplayer_id(session, product_tcgplayer_id)
                        if not product:
                            print(f"Skipping product {product_tcgplayer_id}: Not found in database")
                            continue
                        
                        # Find condition
                        condition_name = product_data.get('condition')
                        if not condition_name:
                            print(f"Skipping product {product_tcgplayer_id}: Missing condition field")
                            continue
                        condition = find_condition_by_name(session, condition_name)
                        if not condition:
                            print(f"Skipping product {product_tcgplayer_id}: Condition '{condition_name}' not found")
                            continue
                        
                        # Find printing
                        printing_name = product_data.get('finish')
                        if not printing_name:
                            print(f"Skipping product {product_tcgplayer_id}: Missing finish field")
                            continue
                        printing = find_printing_by_name(session, printing_name)
                        if not printing:
                            print(f"Skipping product {product_tcgplayer_id}: Printing '{printing_name}' not found")
                            continue
                        
                        # Find SKU
                        sku = find_sku(session, product, condition, printing)
                        if not sku:
                            print(f"Skipping product {product_tcgplayer_id}: SKU not found")
                            continue
                        
                        # Create line item data
                        quantity = int(product_data.get('quantity'))
                        unit_price = Decimal(str(product_data.get('price', '0')))
                        
                        line_item_data: LineItemDataDict = {
                            'sku_id': sku.id,
                            'quantity': quantity,
                            'unit_price_amount': unit_price
                        }
                        
                        line_items_data.append(line_item_data)
                        valid_order = True
                    
                    # Only create transaction if we have valid line items
                    if valid_order and line_items_data:
                        # Use the DAO method to create transaction with line items
                        create_transaction_with_line_items(
                            session, 
                            transaction_data,
                            line_items_data
                        )
                        
                        successful_imports += 1
                        print(f"Successfully imported order {order.get('vendorId')}")
                    else:
                        print(f"Skipping order {order.get('vendorId')}: No valid products")
                    
                except Exception as e:
                    print(f"Error importing order {order.get('vendorId')}: {e}")
                    continue
        
        # Show current progress
        print(f"\nProgress: {successful_imports} orders imported, {skipped_orders} orders skipped")
        
        # Wait for user input if not at the end
        if chunk_end < total_orders:
            user_input = input("\nPress Enter to continue with the next chunk, or type 'quit' to stop: ")
            if user_input.lower() == 'quit':
                print("Import process stopped by user.")
                break
    
    print(f"\nImport complete: {successful_imports} orders imported, {skipped_orders} orders skipped")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Usage: python import_purchase_orders.py <json_file_path> [start_order_id]")
        sys.exit(1)
    
    json_file_path = sys.argv[1]
    start_order_id = sys.argv[2] if len(sys.argv) == 3 else None
    
    import_purchase_orders(json_file_path, start_order_id) 