import { SetList } from "@/features/catalog/components/SetList";

export default async function Page({ params }: { params: { sku: string } }) {
  return <SetList setId={params.sku} />;
}
