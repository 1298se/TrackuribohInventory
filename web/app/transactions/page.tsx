import { createClient } from "@/lib/supabase/server";
import { assertNotNullable } from "@/lib/validation";
import { TransactionsPageContent } from "./transaction-page-content";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();

  assertNotNullable(session.session?.access_token);

  return <TransactionsPageContent token={session.session.access_token} />;
}
