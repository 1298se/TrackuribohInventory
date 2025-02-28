import { z } from "zod"
import { MoneyAmountSchema, MoneySchema } from "../schemas"
import { SKUWithProductResponseSchema } from "../inventory/schemas"

/**
 * TransactionTypeSchema
 */
export const TransactionTypeSchema = z.enum(["PURCHASE", "SALE"])
export type TransactionType = z.infer<typeof TransactionTypeSchema>

/**
 * LineItemBaseSchema
 */
export const LineItemBaseSchema = z.object({
    sku_id: z.string().uuid(),
    quantity: z.number(),
});

export type LineItemBase = z.infer<typeof LineItemBaseSchema>

export const LineItemCreateRequestSchema = LineItemBaseSchema;

/**
 * LineItemResponseSchema
 */
export const LineItemResponseSchema = z.object({
    sku_id: z.string().uuid(),
    quantity: z.number(),
    sku: SKUWithProductResponseSchema,
    price_per_item_amount: MoneyAmountSchema,
});

export type LineItemResponse = z.infer<typeof LineItemResponseSchema>

/**
 * TransactionCreateRequestSchema
 */
export const TransactionCreateRequestSchema = z.object({
    date: z.date(),
    type: TransactionTypeSchema,
    counterparty_name: z.string(),
    comment: z.string().nullable().optional(),
    line_items: z.array(LineItemCreateRequestSchema),
    currency: z.string(),
    shipping_cost_amount: MoneyAmountSchema,
    total_amount: MoneyAmountSchema,
})

export type TransactionCreateRequest = z.infer<typeof TransactionCreateRequestSchema>

/**
 * TransactionResponseSchema
 */
export const TransactionResponseSchema = z.object({
    id: z.string().uuid(),
    date: z.date(),
    type: TransactionTypeSchema,
    counterparty_name: z.string(),
    comment: z.string().nullable(),
    line_items: z.array(LineItemResponseSchema),
    currency: z.string(),
    shipping_cost_amount: MoneyAmountSchema,
})

export type TransactionResponse = z.infer<typeof TransactionResponseSchema>
/**
 * TransactionsResponseSchema
 */
export const TransactionsResponseSchema = z.object({
    transactions: z.array(TransactionResponseSchema)
})

export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>

/**
 * BulkTransactionDeleteRequestSchema
 */
export const BulkTransactionDeleteRequestSchema = z.object({
    transaction_ids: z.array(z.string().uuid()),
});
export type BulkTransactionDeleteRequest = z.infer<typeof BulkTransactionDeleteRequestSchema>
