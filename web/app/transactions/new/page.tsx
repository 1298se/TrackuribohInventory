import { Button } from "@/components/ui/button";
import CreateTransactionFormDialog from "../create-transaction-form-sheet";
import { createClient } from "@/lib/supabase/server";
import { assertNotNullable } from "@/lib/validation";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();

  assertNotNullable(session.session?.access_token);

  return (
    <div className="container">
      <CreateTransactionFormDialog token={session.session.access_token} />
    </div>
  );
}
