import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Trash, Plus, Loader2, Package2, ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectProductDialog } from "../inventory/select-product-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../inventory/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTransaction } from "./api";
import { ProductWithSetAndSKUsResponseSchema, ProductWithSetAndSKUsResponse } from "../inventory/schemas";
import { LineItemCreateRequestSchema, TransactionCreateRequestSchema, TransactionCreateRequest, TransactionTypeSchema, TransactionType } from "./schemas";
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/money-input";
import { QuantityInput } from "@/components/ui/quantity-input";

export const TransactionCreateFormLineItemSchema = LineItemCreateRequestSchema.extend({
    product: ProductWithSetAndSKUsResponseSchema,
})

export const TransactionCreateFormSchema = TransactionCreateRequestSchema.extend({
    counterparty_name: z.string().min(1, "Counterparty name is required"),
    line_items: z.array(TransactionCreateFormLineItemSchema).min(1, "At least one item is required"),
    comment: z.string().max(500, "Comment must be less than 500 characters").optional(),
    shipping_cost_amount: z.number().min(0, "Shipping cost must be greater than or equal to 0").default(0),
    total_amount: z.number().min(0.01, "Total amount must be greater than 0").default(0),
})

type TransactionCreateFormLineItem = z.infer<typeof TransactionCreateFormLineItemSchema>
type TransactionCreateForm = z.infer<typeof TransactionCreateFormSchema>

// Helper function to map the transaction type enum to a display string
function getTransactionTypeDisplay(type: TransactionType): string {
    switch (type) {
        case "SALE":
            return "Sale";
        case "PURCHASE":
            return "Purchase";
        default:
            return type;
    }
}

export default function CreateTransactionFormDialog() {

    const form = useForm<TransactionCreateForm>({
        resolver: zodResolver(TransactionCreateFormSchema),
        defaultValues: {
            shipping_cost_amount: 0.00,
            total_amount: 0.00,
            currency: "USD",
        },
    })

    const router = useRouter();

    const { fields, prepend, remove } = useFieldArray({
        control: form.control,
        name: "line_items",
    })

    const { trigger: createTransaction, isMutating } = useCreateTransaction()

    const [formContainerRef, setFormContainerRef] = useState<HTMLDivElement | null>(null);


    const onSubmit = async (data: TransactionCreateForm) => {
        try {
            // Make sure we're passing the correct fields that match the schema
            const request = TransactionCreateRequestSchema.parse(data)

            const transaction = await createTransaction(request);

            // On success, navigate to the transaction details page
            if (transaction && transaction.id) {
                router.push(`/transactions/${transaction.id}`);
            } else {
                // Fallback to transactions list if response doesn't contain ID
                router.push('/transactions');
            }

        } catch (error) {
            console.error("Failed to create transaction:", error);
        }
    }

    const lineItemColumns: ColumnDef<TransactionCreateFormLineItem>[] = [
        {
            accessorKey: "product.image_url",
            header: "Image",
            cell: ({ row }) => {
                const imageUrl = row.original.product.image_url

                return (
                    <div className="h-16 w-16">
                        <img
                            src={imageUrl}
                            alt="Product"
                            className="h-full w-full object-contain"
                        />
                    </div>
                )
            }
        },
        {
            accessorKey: "product.name",
            header: "Name",
            cell: ({ row }) => {
                const product = row.original.product

                return (
                    <div>
                        {product.name}
                        <div className="text-sm text-muted-foreground">
                            <div>{product.set.name}</div>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "sku_id",
            header: "SKU",
            cell: ({ row }) => {
                return (
                    <FormField
                        control={form.control}
                        name={`line_items.${row.index}.sku_id`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger className="min-w-[300px] max-w-[300px]">
                                            <SelectValue placeholder="Select an SKU" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {row.original.product.skus.map((sku) => (
                                                <SelectItem key={sku.id} value={sku.id}>
                                                    {sku.condition.name} · {sku.printing.name} · {sku.language.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )
            }
        },
        {
            accessorKey: "quantity",
            header: "Qty",
            cell: ({ row }) => {
                return (
                    <FormField
                        control={form.control}
                        name={`line_items.${row.index}.quantity`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <QuantityInput
                                        value={field.value}
                                        className="w-20"
                                        min={0}
                                        max={999}
                                        onChange={(value) => field.onChange(value)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )
            }
        },
        {
            id: "delete",
            header: "",
            cell: ({ row }) => {
                return (
                    <button
                        type="button"
                        onClick={() => {
                            remove(row.index)
                        }}
                        className="text-foreground"
                    >
                        <Trash className="w-4 h-4" />
                    </button>
                )
            },
        },
    ]

    return (
        <Form {...form}>
            <div ref={(ref) => setFormContainerRef(ref)} className="flex flex-col gap-8 pb-32">
                {/* ✨ NEW: Back Button */}
                <div className="flex items-center">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </div>

                {/* Transaction Details Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transaction Details</CardTitle>
                        <CardDescription>
                            Enter the transaction details below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Transaction Details Section - Single Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Transaction Type</FormLabel>
                                        <FormControl>
                                            <Select
                                                value={field.value}
                                                onValueChange={(selectedValue) => {
                                                    form.setValue("type", TransactionTypeSchema.parse(selectedValue))
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {TransactionTypeSchema.options.map((type) => (
                                                        <SelectItem key={type} value={type}>
                                                            {getTransactionTypeDisplay(type)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="counterparty_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Counterparty Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Enter name" />
                                        </FormControl>
                                        <FormDescription>
                                            The name of the buyer or seller
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Transaction Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ? new Date(field.value) : undefined}
                                                    onSelect={(date) => field.onChange(date?.toISOString() ?? '')}
                                                    disabled={(date) =>
                                                        date > new Date() || date < new Date("1900-01-01")
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Total Field */}
                            <FormField
                                control={form.control}
                                name="total_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total</FormLabel>
                                        <FormControl>
                                            <MoneyInput
                                                initialValue={field.value}
                                                onChange={(amount) => field.onChange(amount)}
                                                className="w-full"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Enter the total transaction amount
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="shipping_cost_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Shipping Cost (Optional)</FormLabel>
                                        <FormControl>
                                            <MoneyInput
                                                initialValue={field.value}
                                                onChange={(amount) => field.onChange(amount)}
                                                className="w-full"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="comment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Comment (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Add notes about this transaction"
                                                className="min-h-[80px]"
                                                maxLength={500}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription className="flex justify-end">
                                            <span className="text-muted-foreground">
                                                {field.value?.length || 0}/500
                                            </span>
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Line Items Card */}
                <Card>
                    <div className="flex items-center">
                        <CardHeader>
                            <CardTitle>Line Items</CardTitle>
                        </CardHeader>
                        <SelectProductDialog onSelect={onProductSelected} />
                    </div>
                    <CardContent className="space-y-4">
                        {fields.length > 0 ? (
                            <DataTable columns={lineItemColumns} data={fields} />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8">
                                <div className="text-center space-y-2">
                                    <Package2 className="mx-auto h-8 w-8 text-muted-foreground" />
                                    <h3 className="font-medium">No items added</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Click the Add Item button to start adding items to this transaction.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Add padding to prevent content from being hidden behind the fixed footer */}
                <div className="h-4"></div>
            </div>

            {/* Persistent footer with submit button */}
            <div
                className="fixed bottom-0 py-4 px-4 bg-background border-t shadow-sm z-10"
                style={{
                    width: formContainerRef?.clientWidth ? `${formContainerRef.clientWidth}px` : 'auto',
                    left: formContainerRef?.getBoundingClientRect().left || 0
                }}
            >
                <div className="flex justify-end pr-2">
                    <Button
                        type="button"
                        onClick={() => form.handleSubmit(onSubmit)()}
                        disabled={isMutating || fields.length === 0}
                        className="min-w-[120px]"
                    >
                        {isMutating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Create Transaction'
                        )}
                    </Button>
                </div>
            </div>
        </Form>
    )

    function onProductSelected(product: ProductWithSetAndSKUsResponse) {
        prepend({
            product: product,
            sku_id: product.skus[0].id,
            quantity: 1,
        })
    }
}
