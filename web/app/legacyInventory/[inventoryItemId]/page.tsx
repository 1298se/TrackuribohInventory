import { InventoryItemDetails } from "@/features/inventory/components/InventoryItemDetails";

interface InventoryItemPageProps {
  params: {
    inventoryItemId: string;
  };
}

export default function InventoryItemPage({ params }: InventoryItemPageProps) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <InventoryItemDetails inventoryItemId={params.inventoryItemId} />
    </div>
  );
}
