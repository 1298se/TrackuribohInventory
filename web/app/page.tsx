import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "./api/fetcher";
import { ProductBaseResponseSchema } from "./catalog/schemas";
import { z } from "zod";
import Image from "next/image";

type ProductBaseResponseType = z.infer<typeof ProductBaseResponseSchema>;

export default async function Home() {
  return <SectionCards />;
}

async function SectionCards() {
  const response = await fetch(`${API_URL}/market/products`);
  const data = await response.json();
  const products: ProductBaseResponseType[] =
    ProductBaseResponseSchema.array().parse(data.results);

  console.log(products);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {products.map((product) => (
        <DisplayCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function DisplayCard({ product }: { product: ProductBaseResponseType }) {
  return (
    <Card className="w-[225px] py-4 hover:bg-muted hover:bg-gradient-to-t hover:from-muted/5">
      <CardContent className="px-4 py-0">
        <div className="w-full h-[200px] flex items-center justify-center bg-muted bg-gradient-to-t from-muted/5 rounded-md border">
          <Image
            src={product.image_url}
            alt={product.name}
            width={110}
            height={110}
            className="rounded-sm border-card shadow-2xl"
          />
        </div>
      </CardContent>
      <CardHeader className="px-4 pb-0 pt-4">
        <CardDescription className="mb-0">{product.name}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          $1,250.00{" "}
        </CardTitle>

        <div className="flex items-center gap-1 text-sm text-green-400">
          <IconTrendingUp className="size-4" />
          +12.5%
        </div>
      </CardHeader>
    </Card>
  );
}
