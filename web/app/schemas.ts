import { z } from "zod"

export const MoneyAmountSchema = z.coerce
    .number()
    .refine(
        (n) => !isNaN(n),
        { message: "Amount must be a valid number" }
    )
    .refine(
        (n) => {
            const decimalPart = n.toString().split('.')[1];
            return decimalPart === undefined || decimalPart.length <= 2;
        },
        { message: "Amount must have no more than 2 decimal places" }
    );

export const MoneySchema = z.object({
    amount: MoneyAmountSchema,
    currency: z.string(),
})

export type Money = z.infer<typeof MoneySchema>
