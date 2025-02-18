import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Search, Trash, X, Plus, Loader2, Package2, ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogOverlay, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { SelectProductDialog } from "../inventory/select-product-dialog";
import { Label } from "@/components/ui/label";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../inventory/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTransaction, useCalculateProRata } from "./api";
import { ProductWithSetAndSKUsResponseSchema, ProductWithSetAndSKUsResponse } from "../inventory/schemas";
import { LineItemCreateRequestSchema, TransactionCreateRequestSchema, TransactionCreateRequest, TransactionTypeSchema, TransactionType } from "./schemas";
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation";
import { MoneySchema } from "../schemas";
import { MoneyInput } from "@/components/ui/money-input";

export const TransactionCreateFormMoneySchema = MoneySchema.extend({
    amount: z.string(),
})

export const TransactionCreateFormLineItemSchema = LineItemCreateRequestSchema.extend({
    product: ProductWithSetAndSKUsResponseSchema,
    price_per_item: TransactionCreateFormMoneySchema
})

export const TransactionCreateFormSchema = TransactionCreateRequestSchema.extend({
    line_items: z.array(TransactionCreateFormLineItemSchema).min(1, "At least one item is required"),
    comment: z.string().max(500, "Comment must be less than 500 characters").optional(),
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
        resolver: zodResolver(TransactionCreateFormSchema)
    })

    const router = useRouter();

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "line_items",
    })

    const { trigger: createTransaction, isMutating } = useCreateTransaction()
    const { trigger: calculateProRata } = useCalculateProRata()

    const [isSelectProductDialogOpen, setIsSelectProductDialogOpen] = useState(false)
    const [totalAmount, setTotalAmount] = useState("");

    const onSubmit = async (data: TransactionCreateForm) => {
        try {
            const request: TransactionCreateRequest = {
                date: data.date,
                type: data.type,
                counterparty_name: data.counterparty_name,
                comment: data.comment,
                line_items: data.line_items.map(item => ({
                    sku_id: item.sku_id,
                    quantity: item.quantity,
                    price_per_item:  MoneySchema.parse(item.price_per_item)
                }))
            }

            await createTransaction(request)

        } catch (error) {
            console.error("Failed to create transaction:", error)
        }
    }

    const handleProRataFill = async (totalAmountStr: string) => {
        if (!totalAmountStr || fields.length === 0) return;

        try {
        // Get the full form data to access selected SKUs
        const formData = form.getValues();

        const result = await calculateProRata({
            line_items: formData.line_items.map(item => ({
                sku_id: item.sku_id,
                    quantity: item.quantity
            })),
            total_amount: {
                    amount: totalAmountStr,
                    currency: "USD"
                }
        });

        // Update each line item's price with the calculated pro-rata amount
        result.line_items.forEach((item, index) => {
            form.setValue(
                `line_items.${index}.price_per_item.amount`,
                item.price_per_quantity.amount
            );
            form.setValue(
                `line_items.${index}.price_per_item.currency`,
                item.price_per_quantity.currency
            );
        });
        } catch (error) {
            console.error("Failed to calculate pro-rata distribution:", error);
        }
    };

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
                const name = row.original.product.name

                return (
                    <div>
                        {name}
                        {/* You can add more product details here */}
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
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={field.value}
                                        className="w-20"
                                        min={0}
                                        max={999}
                                        onChange={(e) => {
                                            // parse input as a number
                                            const newQuantity = parseInt(e.target.value, 10)
                                            // ensure value is within bounds
                                            const boundedQuantity = Math.min(Math.max(isNaN(newQuantity) ? 0 : newQuantity, 0), 999)
                                            // call field.onChange to update the form state
                                            field.onChange(boundedQuantity)
                                        }}
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
            accessorKey: "price_per_item",
            header: "Price",
            cell: ({ row }) => {
                return (
                    <FormField
                        control={form.control}
                        name={`line_items.${row.index}.price_per_item.amount`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MoneyInput
                                        value={field.value || ''}
                                        onChange={(e) => field.onChange(e.target.value)}
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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
                        {/* Transaction Details Section */}
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
                                                    selected={field.value}
                                                    onSelect={field.onChange}
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
                        </div>

                        <FormField
                            control={form.control}
                            name="comment"
                            render={({ field }) => (
                                <FormItem className="max-w-[600px]">
                                    <FormLabel>Comment</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add any additional notes about this transaction (optional)"
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
                    </CardContent>
                </Card>

                {/* Line Items Card */}
                <Card>
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-row items-center">
                            <CardHeader>
                                <CardTitle>Line Items</CardTitle>
                            </CardHeader>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsSelectProductDialogOpen(true)}
                            >
                                <Plus className="h-4 w-4" />
                                Add Item
                            </Button>
                        </div>

                        <CardHeader className="flex items-center justify-between">
                            <FormItem>
                                <div className="flex items-center justify-end gap-2">
                                    <MoneyInput
                                        disabled={fields.length === 0}
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="default"
                                        disabled={fields.length === 0}
                                        title="Distribute the entered total among your items"
                                        onClick={() => {
                                            if (totalAmount !== undefined) {
                                                handleProRataFill(totalAmount);
                                            }
                                        }}
                                    >
                                        Distribute
                                    </Button>
                                </div>
                                <FormDescription>
                                    Optionally enter a total amount to distribute among all line items.
                                </FormDescription>
                            </FormItem>
                        </CardHeader>
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

                {/* Final Submit Button */}
                <div className="flex justify-end">
                    <Button
                        type="submit"
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

                {/* Dialog for selecting products */}
                <SelectProductDialog
                    open={isSelectProductDialogOpen}
                    onOpenChange={setIsSelectProductDialogOpen}
                    onSelect={onProductSelected}
                />
            </form>
        </Form>
    )

    function onProductSelected(product: ProductWithSetAndSKUsResponse) {
        append({
            product: product,
            sku_id: "",
            quantity: 1,
            price_per_item: {
                amount: "",
                currency: "USD",
            },
        })

        setIsSelectProductDialogOpen(false)

    }
}
