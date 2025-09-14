import { z } from "zod";
import { SKUWithProductResponseSchema } from "../catalog/schemas";
import { MoneyAmountSchema } from "../schemas";

export const MarketplaceSchema = z.enum(["TCGPLAYER"]);

export const DecisionSchema = z.enum(["BUY", "PASS"]);

export const BuyDecisionResponseSchema = z.object({
  id: z.string(),
  sku: SKUWithProductResponseSchema,
  decision: DecisionSchema,
  quantity: z.number(),
  buy_vwap: MoneyAmountSchema,
  expected_resale_net: MoneyAmountSchema,
  asof_listings: z.string().transform((val) => new Date(val)),
  asof_sales: z.string().transform((val) => new Date(val)),
  reason_codes: z.array(z.string()),
  created_at: z.string().transform((val) => new Date(val)),
});

export const BuyDecisionsResponseSchema = z.object({
  decisions: z.array(BuyDecisionResponseSchema),
  total_count: z.number(),
  filters_applied: z.record(z.any()),
});

export type BuyDecisionResponse = z.infer<typeof BuyDecisionResponseSchema>;
export type BuyDecisionsResponse = z.infer<typeof BuyDecisionsResponseSchema>;
