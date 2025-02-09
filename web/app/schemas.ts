import { z } from "zod"

export const MoneySchema = z.object({
    amount: z.string(),
    currency: z.string(),
})

export type Money = z.infer<typeof MoneySchema>
