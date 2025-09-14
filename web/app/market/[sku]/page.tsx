import { API_URL } from "@/app/api/fetcher";

interface PageProps {
  params: { sku: string };
}

export default async function Page({ params }: PageProps) {
  const { sku } = params; // slug is an array
  console.log(sku);

  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  const data = await response.json();
  console.log(data);

  return (
    <div>
      Path: {sku} <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
