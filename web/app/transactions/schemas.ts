import { z } from "zod"
import { MoneySchema } from "../schemas"
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

/**
 * LineItemProRataResponseSchema
 */
export const LineItemProRataResponseSchema = z.object({
    sku_id: z.string().uuid(),
    price_per_quantity_amount: z.string(),
});

export const LineItemCreateRequestSchema = z.object({
    sku_id: z.string(),
    quantity: z.number().min(1),
    price_per_item_amount: z.string(),
})

export type LineItemProRataResponse = z.infer<typeof LineItemProRataResponseSchema>

/**
 * LineItemResponseSchema
 */
export const LineItemResponseSchema = z.object({
    sku_id: z.string().uuid(),
    quantity: z.number(),
    sku: SKUWithProductResponseSchema,
    price_per_item_amount: z.string(),
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
    currency_code: z.string(),
})

export type TransactionCreateRequest = z.infer<typeof TransactionCreateRequestSchema>

/**
 * LineItemProRataRequestSchema
 */
export const LineItemProRataRequestSchema = z.object({
    sku_id: z.string(),
    quantity: z.number(),
})

/**
 * TransactionProRataRequestSchema
 */
export const TransactionProRataRequestSchema = z.object({
    line_items: z.array(LineItemProRataRequestSchema),
    total_amount: MoneySchema,
})

export type TransactionProRataRequest = z.infer<typeof TransactionProRataRequestSchema>

/**
 * TransactionProRataResponseSchema
 */
export const TransactionProRataResponseSchema = z.object({
    line_items: z.array(LineItemProRataResponseSchema),
})

export type TransactionProRataResponse = z.infer<typeof TransactionProRataResponseSchema>

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
    currency_code: z.string(),
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
