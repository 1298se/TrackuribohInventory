import { z } from "zod"
import { MoneyAmountSchema, MoneySchema } from "../schemas"
import { SKUWithProductResponseSchema } from "../inventory/schemas"

/**
 * TransactionTypeSchema
 */
export const TransactionTypeSchema = z.enum(["PURCHASE", "SALE"])
export type TransactionType = z.infer<typeof TransactionTypeSchema>

/**
 * PlatformResponseSchema
 */
export const PlatformResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
});

export type PlatformResponse = z.infer<typeof PlatformResponseSchema>

/**
 * PlatformCreateRequestSchema
 */
export const PlatformCreateRequestSchema = z.object({
    name: z.string().min(1, "Platform name is required"),
});

export type PlatformCreateRequest = z.infer<typeof PlatformCreateRequestSchema>

/**
 * LineItemBaseSchema
 */
export const LineItemBaseSchema = z.object({
    id: z.string().uuid(),
    quantity: z.number(),
});

export type LineItemBase = z.infer<typeof LineItemBaseSchema>

export const LineItemCreateRequestSchema = z.object({
    sku_id: z.string().uuid(),
    quantity: z.number(),
});

/**
 * LineItemResponseSchema
 */
export const LineItemResponseSchema = z.object({
    id: z.string().uuid(),
    quantity: z.number(),
    sku: SKUWithProductResponseSchema,
    unit_price_amount: MoneyAmountSchema,
});

export type LineItemResponse = z.infer<typeof LineItemResponseSchema>

/**
 * TransactionCreateRequestSchema
 */
export const TransactionCreateRequestSchema = z.object({
    date: z.string().datetime(),
    type: TransactionTypeSchema,
    counterparty_name: z.string(),
    comment: z.string().nullable().optional(),
    line_items: z.array(LineItemCreateRequestSchema),
    currency: z.string(),
    platform_id: z.string().uuid().nullable().optional(),
    shipping_cost_amount: MoneyAmountSchema,
    subtotal_amount: MoneyAmountSchema,
    tax_amount: MoneyAmountSchema,
})

export type TransactionCreateRequest = z.infer<typeof TransactionCreateRequestSchema>

/**
 * TransactionResponseSchema
 */
export const TransactionResponseSchema = z.object({
    id: z.string().uuid(),
    date: z.string().datetime(),
    type: TransactionTypeSchema,
    counterparty_name: z.string(),
    comment: z.string().nullable(),
    line_items: z.array(LineItemResponseSchema),
    platform: PlatformResponseSchema.nullable(),
    currency: z.string(),
    shipping_cost_amount: MoneyAmountSchema,
    tax_amount: MoneyAmountSchema,
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

/**
 * LineItemUpdateRequestSchema
 */
export const LineItemUpdateRequestSchema = z.object({
    id: z.string().uuid().optional(),
    sku_id: z.string().uuid().optional(),
    unit_price_amount: MoneyAmountSchema,
    quantity: z.number(),
});

export type LineItemUpdateRequest = z.infer<typeof LineItemUpdateRequestSchema>

/**
 * TransactionUpdateRequestSchema
 */
export const TransactionUpdateRequestSchema = z.object({
    counterparty_name: z.string(),
    comment: z.string().nullable(),
    currency: z.string(),
    platform_id: z.string().uuid().nullable(),
    shipping_cost_amount: MoneyAmountSchema,
    tax_amount: MoneyAmountSchema,
    date: z.string().datetime(),
    line_items: z.array(LineItemUpdateRequestSchema),
})

export type TransactionUpdateRequest = z.infer<typeof TransactionUpdateRequestSchema>
