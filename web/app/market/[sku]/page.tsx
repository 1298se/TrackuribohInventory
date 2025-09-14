import { API_URL } from "@/app/api/fetcher";
import { ProductWithSetAndSKUs } from "@/app/catalog/schemas";
import { getLargeTCGPlayerImage } from "@/features/market/utils";
import Image from "next/image";

interface PageProps {
  params: { sku: string };
}

export default async function Page({ params }: PageProps) {
  const { sku } = params; // slug is an array
  console.log(sku);

  const response = await fetch(`${API_URL}/catalog/product/${sku}`);
  const product: ProductWithSetAndSKUs = await response.json();

  return (
    <div>
      <h1>{product.name}</h1>
      <Image
        src={getLargeTCGPlayerImage({ imageUrl: product.image_url, size: 600 })}
        alt={product.name}
        width={350}
        height={350}
        className="rounded-xl shadow-2xl"
      />
      {/* <Image
        src={getLargeTCGPlayerImage({ imageUrl: product.image_url })}
        alt={product.name}
        width={200}
        height={280}
        className="rounded-md shadow-2xl"
      /> */}
    </div>
  );
}
