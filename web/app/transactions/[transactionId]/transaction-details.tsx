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
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form"
import { MoneyAmountSchema } from "@/app/schemas"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface TransactionDetailsProps {
    transactionId: string
}

// Define a schema for line item edits by extending the API schema with additional validation
const LineItemEditSchema = LineItemResponseSchema.extend({
    unit_price_amount: MoneyAmountSchema.refine(
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

// First, let's define separate components for header and content skeletons
function TransactionDetailsSkeletonHeader() {
    return (
        <CardHeader className="flex flex-row justify-between">
            <div>
                <Skeleton className="h-8 w-[300px]" /> {/* Amount + transaction type */}
            </div>
            <Skeleton className="h-9 w-24" /> {/* Edit button */}
        </CardHeader>
    )
}

function TransactionDetailsSkeletonContent() {
    return (
        <CardContent>
            <div className="space-y-6">
                {/* Form fields grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={i === 4 ? "pb-4" : ""}>
                            <Skeleton className="h-4 w-24 mb-2" /> {/* Label */}
                            <Skeleton className="h-10 w-full" /> {/* Input */}
                        </div>
                    ))}
                </div>
                
                {/* Total amount */}
                <div>
                    <Skeleton className="h-4 w-24 mb-2" /> {/* Label */}
                    <Skeleton className="h-8 w-32" /> {/* Amount */}
                </div>
                
                <Separator />
            </div>
        </CardContent>
    )
}

const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />
const ProductLoading = () => (
    <>
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px] mt-2" />
    </>
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
    })

    // Use useFieldArray to manage the array of line items
    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "line_items",
    })

    // Update fields whenever transaction changes
    useEffect(() => {
        if (transaction && !isEditing) {
            const lineItems = transaction.line_items.map(item => ({
                id: item.id,
                unit_price_amount: item.unit_price_amount,
                quantity: item.quantity,
                sku: item.sku
            }));

            form.reset({
                counterparty_name: transaction.counterparty_name,
                comment: transaction.comment,
                currency: transaction.currency,
                shipping_cost_amount: transaction.shipping_cost_amount,
                date: transaction.date,
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
                return imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={row.original.sku?.product.name || "Product image"}
                        className="h-16 w-16 object-contain rounded-md"
                    />
                ) : null
            }
        },
        {
            accessorKey: "sku.product.name",
            header: "Product",
            loading: ProductLoading,
            cell: ({ row }) => row.original.sku ? <SKUDisplay sku={row.original.sku} /> : null
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
            accessorKey: "unit_price_amount",
            header: "Unit Price",
            loading: DefaultLoading,
            cell: ({ row }) => {
                if (isEditing) {
                    return (
                        <FormField
                            control={form.control}
                            name={`line_items.${row.index}.unit_price_amount`}
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
                const amount = row.original.unit_price_amount
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
                const unitPrice = row.original.unit_price_amount
                const total = Number((unitPrice * quantity).toFixed(2))
                const formatted = Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: transaction?.currency || "USD",
                }).format(total)
                return <div className="font-medium tabular-nums">{formatted}</div>
            }
        },
    ], [isEditing, form.control, transaction?.currency]);

    const handleSaveChanges = async () => {
        try {
            const valid = await form.trigger();
            if (!valid) {
                toast({
                    title: "Validation Error",
                    description: "Please check the form for errors.",
                    variant: "destructive"
                });
                return;
            }

            const formData = form.getValues();
            const updatedLineItems: LineItemUpdateRequest[] = formData.line_items
                .filter((item) => {
                    const originalItem = transaction?.line_items.find(li => li.id === item.id);
                    if (!originalItem) return false;
                    return item.unit_price_amount !== originalItem.unit_price_amount ||
                        item.quantity !== originalItem.quantity;
                })
                .map(item => ({
                    id: item.id,
                    unit_price_amount: item.unit_price_amount,
                    quantity: item.quantity
                }));

            const hasDetailsChanged =
                formData.counterparty_name !== transaction!.counterparty_name ||
                formData.comment !== transaction!.comment ||
                formData.currency !== transaction!.currency ||
                formData.shipping_cost_amount !== transaction!.shipping_cost_amount ||
                formData.date !== transaction!.date;

            if (updatedLineItems.length === 0 && !hasDetailsChanged) {
                setIsEditing(false);
                return;
            }

            const updateRequestData: TransactionUpdateRequest = {
                counterparty_name: formData.counterparty_name,
                comment: formData.comment,
                currency: formData.currency,
                shipping_cost_amount: formData.shipping_cost_amount,
                date: formData.date,
                line_items: updatedLineItems
            };

            await updateTransaction({
                id: transactionId,
                data: updateRequestData
            });

            setIsEditing(false);
            await mutate();

            toast({
                title: "Changes saved",
                description: "Transaction has been updated successfully."
            });
        } catch (error) {
            console.error("Failed to update transaction:", error);
            toast({
                title: "Error saving changes",
                description: "Failed to update transaction. Please try again.",
                variant: "destructive"
            });
        }
    }

    // Early return for error states
    if (error) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load transaction details. Please try again later.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!isLoading && !transaction) {
        return (
            <div className="space-y-4">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Transaction not found.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const totalAmount = isEditing && fields.length > 0
        ? fields.reduce((sum, item) => sum + Number((item.unit_price_amount * item.quantity).toFixed(2)), 0)
        : transaction?.line_items.reduce((sum, item) => sum + Number((item.unit_price_amount * item.quantity).toFixed(2)), 0) || 0

    const currency = transaction?.currency || "USD"

    return (
        <div className="space-y-4">
            <Card>
                {/* Header - either skeleton or actual content */}
                {!transaction ? (
                    <TransactionDetailsSkeletonHeader />
                ) : (
                    <CardHeader className="flex flex-row justify-between">
                        <CardTitle>
                            {transaction.type === "PURCHASE"
                                ? `${Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: currency,
                                }).format(totalAmount)} purchase from ${transaction.counterparty_name}`
                                : `${Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: currency,
                                }).format(totalAmount)} sale to ${transaction.counterparty_name}`
                            }
                        </CardTitle>
                        {isEditing ? (
                            <div className="space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsEditing(false);
                                        form.reset();
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
                                Edit Details
                            </Button>
                        )}
                    </CardHeader>
                )}

                {/* Main content - either skeleton with loading DataTable or full form with DataTable */}
                {!transaction ? (
                    <>
                        <TransactionDetailsSkeletonContent />
                        <CardContent className="pt-0">
                            <DataTable
                                columns={lineItemColumns}
                                data={[]}
                                loading={true}
                            />
                        </CardContent>
                    </>
                ) : (
                    <CardContent>
                        <Form {...form}>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Date</FormLabel>
                                                {isEditing ? (
                                                    <>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                        variant="outline"
                                                                        className={cn(
                                                                            "w-full pl-3 text-left font-normal",
                                                                            !field.value && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {field.value ? (
                                                                            format(new Date(field.value), "MMMM d, yyyy")
                                                                        ) : (
                                                                            <span>Select a date</span>
                                                                        )}
                                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={field.value ? new Date(field.value) : undefined}
                                                                    onSelect={(date) => field.onChange(date ? date.toISOString() : "")}
                                                                    disabled={(date) =>
                                                                        date > new Date() || date < new Date("1900-01-01")
                                                                    }
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </>
                                                ) : (
                                                    <div className="mt-2">
                                                        {format(new Date(transaction.date), "MMMM d, yyyy")}
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="counterparty_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Counterparty Name</FormLabel>
                                                {isEditing ? (
                                                    <>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </>
                                                ) : (
                                                    <div className="mt-2">
                                                        {transaction.counterparty_name}
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="shipping_cost_amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Shipping Cost</FormLabel>
                                                {isEditing ? (
                                                    <>
                                                        <FormControl>
                                                            <MoneyInput
                                                                initialValue={field.value}
                                                                onChange={(amount) => field.onChange(amount)}
                                                                className="w-full"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </>
                                                ) : (
                                                    <div className="mt-2">
                                                        {Intl.NumberFormat("en-US", {
                                                            style: "currency",
                                                            currency: transaction.currency,
                                                        }).format(transaction.shipping_cost_amount)}
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="comment"
                                        render={({ field }) => (
                                            <FormItem className={isEditing ? "pb-4" : ""}>
                                                <FormLabel>Comment</FormLabel>
                                                {isEditing ? (
                                                    <>
                                                        <FormControl>
                                                            <Textarea 
                                                                {...field} 
                                                                value={field.value || ""}
                                                                placeholder="Add a comment about this transaction"
                                                                className="resize-none h-20"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </>
                                                ) : (
                                                    <div className="mt-2">
                                                        {transaction.comment ? (
                                                            <span className="whitespace-pre-wrap">{transaction.comment}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground italic">No comment</span>
                                                        )}
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Separator />
                                
                                {/* DataTable section now inside Form */}
                                <div className="space-y-4">
                                    <FormLabel>Items</FormLabel>
                                    <div className="mt-2">
                                        <DataTable
                                            columns={lineItemColumns}
                                            data={fields}
                                            loading={false}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Form>
                    </CardContent>
                )}
            </Card>
        </div>
    );
} 