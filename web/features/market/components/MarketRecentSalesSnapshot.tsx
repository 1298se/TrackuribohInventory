import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const recentSales = [
  {
    id: "TCG001",
    cardName: "Charmander - Base Set",
    condition: "Near Mint",
    price: "$12.50",
    soldDate: new Date("2024-01-15"),
    seller: "CardCollector99",
    quantity: 1,
  },
  {
    id: "TCG002",
    cardName: "Charmander - Evolutions",
    condition: "Lightly Played",
    price: "$8.75",
    soldDate: new Date("2024-01-14"),
    seller: "PokemonMaster",
    quantity: 2,
  },
  {
    id: "TCG003",
    cardName: "Charmander - XY Base Set",
    condition: "Near Mint",
    price: "$6.25",
    soldDate: new Date("2024-01-13"),
    seller: "TradingCardKing",
    quantity: 1,
  },
  {
    id: "TCG004",
    cardName: "Charmander - Base Set",
    condition: "Moderately Played",
    price: "$9.50",
    soldDate: new Date("2024-01-12"),
    seller: "VintageCards",
    quantity: 1,
  },
  {
    id: "TCG005",
    cardName: "Charmander - Evolutions",
    condition: "Near Mint",
    price: "$11.00",
    soldDate: new Date("2024-01-11"),
    seller: "CardShopPro",
    quantity: 3,
  },
];

export function MarketRecentSalesSnapshot() {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Condition</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="min-h-[370px]">
        {recentSales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell>{sale.condition}</TableCell>
            <TableCell className="text-right font-medium">
              {sale.price}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(sale.soldDate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
