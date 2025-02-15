import { z } from "zod"
import { MoneySchema } from "../schemas"
import { LineItemResponseSchema } from "../inventory/schemas"

export const TransactionTypeSchema = z.enum(["PURCHASE", "SALE"])
export type TransactionType = z.infer<typeof TransactionTypeSchema>

export const LineItemCreateRequestSchema = z.object({
    sku_id: z.string(),
    quantity: z.number().min(1),
    price_per_item: MoneySchema,
})

export const TransactionCreateRequestSchema = z.object({
    date: z.date(),
    type: TransactionTypeSchema,
    counterparty_name: z.string(),
    comment: z.string().nullable().optional(),
    line_items: z.array(LineItemCreateRequestSchema),
})

export type TransactionCreateRequest = z.infer<typeof TransactionCreateRequestSchema>

export const LineItemProRataRequestSchema = z.object({
    sku_id: z.string(),
    quantity: z.number(),
})

export const TransactionProRataRequestSchema = z.object({
    line_items: z.array(LineItemProRataRequestSchema),
    total_amount: MoneySchema,
})

export type TransactionProRataRequest = z.infer<typeof TransactionProRataRequestSchema>

export const LineItemProRataResponseSchema = z.object({
    sku_id: z.string(),
    quantity: z.number(),
    price_per_quantity: MoneySchema,
})

export const TransactionProRataResponseSchema = z.object({
    line_items: z.array(LineItemProRataResponseSchema),
})

export type TransactionProRataResponse = z.infer<typeof TransactionProRataResponseSchema>

export const TransactionResponseSchema = z.object({
    id: z.string().uuid(),
    date: z.date(),
    type: TransactionTypeSchema,
    counterparty_name: z.string(),
    comment: z.string().nullable(),
    line_items: z.array(LineItemResponseSchema),
})

export const TransactionsResponseSchema = z.object({
    transactions: z.array(TransactionResponseSchema)
})

export type TransactionResponse = z.infer<typeof TransactionResponseSchema>
export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>

export const BulkTransactionDeleteRequestSchema = z.object({
    transaction_ids: z.array(z.string().uuid()),
});
export type BulkTransactionDeleteRequest = z.infer<typeof BulkTransactionDeleteRequestSchema>
