"use client"

import { format } from "date-fns"
import { SKUDisplay } from "@/components/ui/sku-display"
import { Separator } from "@/components/ui/separator"
import { useTransaction, useUpdateTransaction } from "../api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { DataTable } from "../../inventory/data-table"
import { type Column } from "../../inventory/data-table"
import { LineItemResponse, LineItemResponseSchema, LineItemUpdateRequest, LineItemUpdateRequestSchema, TransactionUpdateRequest, TransactionUpdateRequestSchema } from "../schemas"
import { MoneyInput } from "@/components/ui/money-input"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { QuantityInput } from "@/components/ui/quantity-input"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { MoneyAmountSchema } from "@/app/schemas"

interface TransactionDetailsProps {
    transactionId: string
}

// Define a schema for line item edits by extending the API schema with additional validation
const LineItemEditSchema = LineItemResponseSchema.extend({
    price_per_item_amount: MoneyAmountSchema.refine(
        (value) => value > 0, 
        { message: "Price cannot be zero" }
    ),
    quantity: z.number().int().min(1, "Quantity must be at least 1")
})

// Define the form schema with an array of line items by extending the transaction update schema
const TransactionEditFormSchema = TransactionUpdateRequestSchema.extend({
    // Override the line_items field with our enhanced validation
    line_items: z.array(LineItemEditSchema)
})

type LineItemEdit = z.infer<typeof LineItemEditSchema>
type TransactionEditForm = z.infer<typeof TransactionEditFormSchema>

function TransactionDetailsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <Skeleton className="h-6 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
            <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
            </div>
            <Separator />
            <div className="space-y-4">
                <Skeleton className="h-4 w-16" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                        <Skeleton className="h-16 w-16 rounded-md" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                    </div>
                ))}
            </div>
        </div>
    )
}

const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />
const ProductLoading = () => (
    <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
    </div>
)
const DefaultLoading = () => <Skeleton className="h-4 w-24" />

export function TransactionDetails({ transactionId }: TransactionDetailsProps) {
    const { data: transaction, isLoading, error, mutate } = useTransaction(transactionId)
    const { trigger: updateTransaction, isMutating } = useUpdateTransaction()
    const { toast } = useToast()
    const [isEditing, setIsEditing] = useState(false)

    // Initialize form with react-hook-form
    const form = useForm<TransactionEditForm>({
        resolver: zodResolver(TransactionEditFormSchema),
        defaultValues: {
            line_items: []
        },
    })

    // Use useFieldArray to manage the array of line items
    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "line_items",
    })

    console.log(form.getValues())
    console.log(form.formState.errors)

    // Update fields whenever transaction changes
    useEffect(() => {
        if (transaction && !isEditing) {
            const lineItems = transaction.line_items.map(item => ({
                id: item.id,
                price_per_item_amount: item.price_per_item_amount,
                quantity: item.quantity,
                // Add sku for rendering in DataTable
                sku: item.sku
            }));

            // Use reset to update all form fields
            form.reset({
                date: transaction.date, 
                counterparty_name: transaction.counterparty_name,
                comment: transaction.comment,
                currency: transaction.currency,
                shipping_cost_amount: transaction.shipping_cost_amount,
                line_items: lineItems
            });
        }
    }, [transaction, isEditing, form]);

    const lineItemColumns = useMemo<Column<LineItemEdit, any>[]>(() => [
        {
            accessorKey: "sku.product.image_url",
            header: "Image",
            loading: ImageLoading,
            cell: ({ row }) => {
                const imageUrl = row.original.sku?.product.image_url
                return (
                    <div className="h-16 w-16">
                        {imageUrl && (
                            <img
                                src={imageUrl}
                                alt={row.original.sku?.product.name || "Product image"}
                                className="h-full w-full object-contain rounded-md"
                            />
                        )}
                    </div>
                )
            }
        },
        {
            accessorKey: "sku.product.name",
            header: "Product",
            loading: ProductLoading,
            cell: ({ row }) => {
                return row.original.sku ? <SKUDisplay sku={row.original.sku} /> : null
            }
        },
        {
            accessorKey: "quantity",
            header: "Quantity",
            loading: DefaultLoading,
            cell: ({ row }) => {
                if (isEditing) {
                    return (
                        <FormField
                            control={form.control}
                            name={`line_items.${row.index}.quantity`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <QuantityInput
                                            value={field.value}
                                            onChange={(value) => field.onChange(value)}
                                            className="w-16"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )
                }

                return <div className="font-medium tabular-nums">{row.getValue("quantity")}</div>
            }
        },
        {
            accessorKey: "price_per_item_amount",
            header: "Unit Price",
            loading: DefaultLoading,
            cell: ({ row }) => {
                if (isEditing) {
                    return (
                        <FormField
                            control={form.control}
                            name={`line_items.${row.index}.price_per_item_amount`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MoneyInput
                                            initialValue={field.value}
                                            onChange={(value) => field.onChange(value)}
                                            className="w-20"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )
                }

                const amount = row.original.price_per_item_amount
                const formatted = Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: transaction?.currency || "USD",
                }).format(amount)
                return <div className="font-medium tabular-nums">{formatted}</div>
            }
        },
        {
            id: "total_price",
            header: "Total Price",
            loading: DefaultLoading,
            cell: ({ row }) => {
                const quantity = row.original.quantity
                const unitPrice = row.original.price_per_item_amount
                const total = Number((unitPrice * quantity).toFixed(2))
                const formatted = Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: transaction?.currency || "USD",
                }).format(total)
                return <div className="font-medium tabular-nums">{formatted}</div>
            }
        },
    ], [isEditing, fields, form.control, transaction?.currency, form]);

    const handleSaveChanges = async () => {
        try {
            console.log("Saving changes")
            // Validate form data
            const valid = await form.trigger();
            if (!valid) {
                toast({
                    title: "Validation Error",
                    description: "Please check the form for errors.",
                    variant: "destructive"
                });
                return;
            }

            // Get the form data validated against TransactionEditFormSchema
            const formData = form.getValues();

            // Find changed items by comparing with original data
            const updatedLineItems: LineItemUpdateRequest[] = formData.line_items
                .filter((item) => {
                    const originalItem = transaction?.line_items.find(li => li.id === item.id);
                    if (!originalItem) return false;

                    // Include item if price or quantity has changed
                    return item.price_per_item_amount !== originalItem.price_per_item_amount ||
                        item.quantity !== originalItem.quantity;
                })
                .map(item => ({
                    id: item.id,
                    price_per_item_amount: item.price_per_item_amount,
                    quantity: item.quantity
                }));

            if (updatedLineItems.length === 0) {
                setIsEditing(false);
                return;
            }

            // Create the request data from the TransactionEditFormSchema
            const updateRequestData: TransactionUpdateRequest = {
                date: transaction!.date,  // Use the existing date
                counterparty_name: transaction!.counterparty_name,  // Use the existing counterparty name
                comment: transaction!.comment,  // Use the existing comment
                currency: transaction!.currency,  // Use the existing currency
                shipping_cost_amount: transaction!.shipping_cost_amount,  // Use the existing shipping cost
                line_items: updatedLineItems
            };

            // Call the update API
            await updateTransaction({
                id: transactionId,
                data: updateRequestData
            });

            // Clear editing state
            setIsEditing(false);

            // Refresh transaction data
            await mutate();

            toast({
                title: "Changes saved",
                description: "Transaction prices and quantities have been updated successfully."
            });
        } catch (error) {
            console.error("Failed to update transaction:", error);
            toast({
                title: "Error saving changes",
                description: "Failed to update transaction prices and quantities. Please try again.",
                variant: "destructive"
            });
        }
    }

    // Calculate the total amount based on the active data source (fields or transaction)
    const totalAmount = isEditing && fields.length > 0
        ? fields.reduce((sum, item) => {
            return sum + Number((item.price_per_item_amount * item.quantity).toFixed(2))
        }, 0)
        : transaction?.line_items.reduce((sum, item) => {
            return sum + Number((item.price_per_item_amount * item.quantity).toFixed(2))
        }, 0) || 0

    const currency = transaction?.currency || "USD"

    return (
        <div className="space-y-4">
            {isLoading && <TransactionDetailsSkeleton />}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load transaction details. Please try again later.
                    </AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && !transaction && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Transaction not found.
                    </AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && transaction && (
                <Form {...form}>
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold">
                                {transaction.type === "PURCHASE"
                                    ? `Purchase from ${transaction.counterparty_name}`
                                    : `Sale to ${transaction.counterparty_name}`
                                }
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {format(new Date(transaction.date), "MMMM d, yyyy")}
                            </p>
                        </div>
                        <div>
                            {isEditing ? (
                                <div className="space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setIsEditing(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={form.handleSubmit(handleSaveChanges)}
                                        type="submit"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Edit Items
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="text-sm font-medium">Total Amount</div>
                        <div className="text-2xl font-bold">
                            {Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: currency,
                            }).format(totalAmount)}
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Items</h3>
                        <DataTable
                            columns={lineItemColumns}
                            data={fields}
                            loading={false}
                        />
                    </div>
                </Form>
            )}
        </div>
    )
} 