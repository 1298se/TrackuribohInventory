import { createClient } from "@/lib/supabase/server";
import { assertNotNullable } from "@/lib/validation";
import { InventoryPage } from "./inventory-page";

export default async function InventoryPageContent() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();

  assertNotNullable(session.session?.access_token);

  return <InventoryPage token={session.session.access_token} />;
}
