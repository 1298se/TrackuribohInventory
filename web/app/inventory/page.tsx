"use client";
// No imports needed for Button or routing here
// Import InventoryTable only
import { InventoryTable } from "./inventory-table";

export default function InventoryPage() {
  return (
    <div className="container space-y-4">
      <InventoryTable />
    </div>
  );
}
