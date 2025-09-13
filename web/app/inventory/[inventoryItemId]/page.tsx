import { createClient } from "@/lib/supabase/server";
import { InventoryItemDetails } from "./inventory-item-details";
import { assertNotNullable } from "@/lib/validation";

interface InventoryItemPageProps {
  params: {
    inventoryItemId: string;
  };
}

export default async function InventoryItemPage({
  params,
}: InventoryItemPageProps) {
  const supabase = await createClient();
  const { data: session, error: sessionError } =
    await supabase.auth.getSession();

  assertNotNullable(session.session?.access_token);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <InventoryItemDetails
        inventoryItemId={params.inventoryItemId}
        token={session.session?.access_token}
      />
    </div>
  );
}
