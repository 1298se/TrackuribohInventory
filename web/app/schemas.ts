import { z } from "zod"

export const MoneySchema = z.object({
    amount: z.number(),
    currency: z.string(),
})

export type Money = z.infer<typeof MoneySchema>
