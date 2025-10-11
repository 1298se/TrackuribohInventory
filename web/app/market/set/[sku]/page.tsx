import { SetList } from "@/features/catalog/components/SetList";

export default async function Page({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  return <SetList setId={sku} />;
}
