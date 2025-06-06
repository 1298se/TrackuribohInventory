"use client";

import { format } from "date-fns";
import { ProductDisplay } from "@/components/product-display";
import { Separator } from "@/components/ui/separator";
import {
  useTransaction,
  useUpdateTransaction,
  usePlatforms,
  useCalculateWeightedPrices,
} from "../api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { DataTable } from "../../../components/data-table";
import { type Column } from "../../../components/data-table";
import {
  LineItemUpdateRequest,
  LineItemUpdateRequestSchema,
  TransactionUpdateRequest,
  TransactionUpdateRequestSchema,
  WeightedPriceCalculationRequest,
} from "../schemas";
import { MoneyInput } from "@/components/ui/money-input";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QuantityInput } from "@/components/ui/quantity-input";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { MoneyAmountSchema } from "@/app/schemas";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SelectProductDialog } from "../../inventory/select-product-dialog";
import { Trash } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { FormFieldPlatformSelect } from "@/components/ui/platform-select";
import {
  ProductWithSetAndSKUsResponse,
  SKUWithProductResponseSchema,
} from "@/app/catalog/schemas";
import { formatSKU } from "@/app/catalog/utils";

interface TransactionDetailsProps {
  transactionId: string;
}

// Define a schema for line item edits by extending the API schema with additional validation
const LineItemEditSchema = LineItemUpdateRequestSchema.extend({
  sku: SKUWithProductResponseSchema,
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

// Define the form schema with an array of line items by extending the transaction update schema
const TransactionEditFormSchema = TransactionUpdateRequestSchema.extend({
  // Override the line_items field with our enhanced validation
  line_items: z.array(LineItemEditSchema),
});

type LineItemEdit = z.infer<typeof LineItemEditSchema>;
type TransactionEditForm = z.infer<typeof TransactionEditFormSchema>;

// First, let's define loading components for various parts
const ImageLoading = () => <Skeleton className="h-16 w-16 rounded-md" />;
const ProductLoading = () => (
  <>
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px] mt-2" />
  </>
);
const DefaultLoading = () => <Skeleton className="h-4 w-24" />;
const InputLoading = () => (
  <div>
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-10 w-full" />
  </div>
);
const TextLoading = () => (
  <>
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-6 w-3/4 mt-2" />
  </>
);

export function TransactionDetails({ transactionId }: TransactionDetailsProps) {
  const {
    data: transaction,
    isLoading,
    error,
    mutate,
  } = useTransaction(transactionId);
  const { trigger: updateTransaction, isMutating } = useUpdateTransaction();
  const { data: platforms, isLoading: isPlatformsLoading } = usePlatforms();
  const { trigger: calculatePrices, isMutating: isCalculating } =
    useCalculateWeightedPrices();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSelectProductDialogOpen, setIsSelectProductDialogOpen] =
    useState(false);

  // Initialize form with react-hook-form
  const form = useForm<TransactionEditForm>({
    resolver: zodResolver(TransactionEditFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  // Watch selected platform to conditionally show Order ID field
  const selectedPlatformId = form.watch("platform_id");

  // Use useFieldArray to manage the array of line items
  const { fields, remove, prepend, update } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  // Update fields whenever transaction changes
  useEffect(() => {
    if (transaction && !isEditing) {
      const lineItems = transaction.line_items.map((item) => ({
        id: item.id,
        unit_price_amount: item.unit_price_amount,
        quantity: item.quantity,
        sku: item.sku,
      }));

      form.reset({
        counterparty_name: transaction.counterparty_name,
        comment: transaction.comment,
        currency: transaction.currency,
        platform_id: transaction.platform?.id || null,
        platform_order_id: transaction.platform_order_id ?? null,
        shipping_cost_amount: transaction.shipping_cost_amount,
        tax_amount: transaction.tax_amount,
        date: transaction.date,
        line_items: lineItems,
      });
    }
  }, [transaction, isEditing, form]);

  const lineItemColumns = useMemo<Column<LineItemEdit, any>[]>(
    () => [
      {
        accessorKey: "sku.product.image_url",
        header: "Image",
        loading: ImageLoading,
        cell: ({ row }) => {
          const imageUrl = row.original.sku?.product.image_url;
          const productName = row.original.sku?.product.name || "Product image";

          return imageUrl ? (
            <ProductImage src={imageUrl} alt={productName} />
          ) : null;
        },
      },
      {
        accessorKey: "sku.product.name",
        header: "Product",
        loading: ProductLoading,
        cell: ({ row }) =>
          row.original.sku ? (
            <ProductDisplay product={row.original.sku.product} />
          ) : null,
      },
      {
        id: "sku",
        header: "SKU",
        loading: DefaultLoading,
        cell: ({ row }) => {
          const originalSku = row.original.sku;
          if (!originalSku) return null;
          if (isEditing) {
            return (
              <FormField
                control={form.control}
                key={row.original.id}
                name={`line_items.${row.index}.sku`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Select
                        value={field.value.id}
                        onValueChange={(skuId) => {
                          const product = originalSku.product;
                          const newSku = product.skus.find(
                            (s) => s.id === skuId,
                          );
                          if (newSku) {
                            update(row.index, {
                              ...fields[row.index],
                              sku: { ...newSku, product },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="min-w-[200px]">
                          <SelectValue placeholder="Select SKU" />
                        </SelectTrigger>
                        <SelectContent>
                          {originalSku.product.skus.map((sku) => (
                            <SelectItem key={sku.id} value={sku.id}>
                              {formatSKU(
                                sku.condition,
                                sku.printing,
                                sku.language,
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          }
          // In view mode, show only SKU variant details (without repeating product)
          return (
            <div className="text-sm font-medium">
              {formatSKU(
                originalSku.condition,
                originalSku.printing,
                originalSku.language,
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        align: "right",
        loading: DefaultLoading,
        cell: ({ row }) => {
          if (isEditing) {
            return (
              <FormField
                control={form.control}
                key={row.original.id}
                name={`line_items.${row.index}.quantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <QuantityInput
                        value={field.value}
                        onChange={field.onChange}
                        className="w-16"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          }
          return (
            <div className="font-medium tabular-nums text-right">
              {row.getValue("quantity")}
            </div>
          );
        },
      },
      {
        accessorKey: "unit_price_amount",
        header: "Unit Price",
        align: "right",
        loading: DefaultLoading,
        cell: ({ row }) => {
          if (isEditing) {
            return (
              <FormField
                control={form.control}
                key={row.original.id}
                name={`line_items.${row.index}.unit_price_amount`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onChange={field.onChange}
                        className="w-20"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          }
          const amount = row.original.unit_price_amount;
          const formatted = Intl.NumberFormat("en-US", {
            style: "currency",
            currency: transaction?.currency || "USD",
          }).format(amount);
          return (
            <div className="font-medium tabular-nums text-right">
              {formatted}
            </div>
          );
        },
      },
      {
        id: "total_price",
        header: "Total Price",
        align: "right",
        loading: DefaultLoading,
        cell: ({ row }) => {
          const quantity = row.original.quantity;
          const unitPrice = row.original.unit_price_amount;
          const total = Number((unitPrice * quantity).toFixed(2));
          const formatted = Intl.NumberFormat("en-US", {
            style: "currency",
            currency: transaction?.currency || "USD",
          }).format(total);
          return (
            <div className="font-medium tabular-nums text-right">
              {formatted}
            </div>
          );
        },
      },
      {
        id: "delete",
        header: "",
        cell: ({ row }) => {
          if (!isEditing) return null;

          return (
            <button
              type="button"
              onClick={() => {
                remove(row.index);
              }}
              className="text-foreground"
            >
              <Trash className="w-4 h-4" />
            </button>
          );
        },
      },
    ],
    [isEditing, form.control, transaction?.currency],
  );

  const handleSaveChanges = async () => {
    try {
      const valid = await form.trigger();
      if (!valid) {
        toast({
          title: "Validation Error",
          description: "Please check the form for errors.",
          variant: "destructive",
        });
        return;
      }

      const formData = form.getValues();
      // Include all line items in the update request, whether they've changed or not
      const updatedLineItems: LineItemUpdateRequest[] = formData.line_items.map(
        (item) => ({
          // For new items, use empty string; for existing items, use their ID
          id: item.id,
          sku_id: item.sku?.id,
          unit_price_amount: item.unit_price_amount,
          quantity: item.quantity,
        }),
      );

      const updateRequestData: TransactionUpdateRequest = {
        counterparty_name: formData.counterparty_name,
        comment: formData.comment,
        currency: formData.currency,
        platform_id: formData.platform_id,
        platform_order_id: formData.platform_order_id,
        shipping_cost_amount: formData.shipping_cost_amount,
        tax_amount: formData.tax_amount,
        date: formData.date,
        line_items: updatedLineItems,
      };

      await updateTransaction({
        id: transactionId,
        data: updateRequestData,
      });

      setIsEditing(false);
      await mutate();

      toast({
        title: "Changes saved",
        description: "Transaction has been updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update transaction:", error);
      toast({
        title: "Error saving changes",
        description: "Failed to update transaction. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handler for redistributing prices based on original transaction total
  const handleRedistributePrices = async () => {
    if (!transaction) return;

    const currentLineItems = form.getValues("line_items");

    // Validate that all line items have a valid sku_id
    if (currentLineItems.some((item) => !item.sku?.id)) {
      toast({
        title: "Missing SKU",
        description:
          "Cannot redistribute prices. One or more line items is missing SKU information.",
        variant: "destructive",
      });
      return;
    }

    // Calculate the original total amount from the transaction
    const originalTotalAmount = transaction.line_items.reduce(
      (sum, item) => sum + item.unit_price_amount * item.quantity,
      0,
    );

    // Prepare the request payload with line items from the form
    const requestPayload: WeightedPriceCalculationRequest = {
      line_items: currentLineItems.map((item: LineItemEdit) => ({
        sku_id: item.sku?.id || "",
        quantity: item.quantity,
      })),
      total_amount: originalTotalAmount,
    };

    toast({ title: "Redistributing prices..." });

    try {
      // Call the API to calculate weighted prices
      const result = await calculatePrices(requestPayload);

      if (result && result.calculated_line_items) {
        // Create a map for fast lookup of prices by sku_id
        const priceMap = new Map(
          result.calculated_line_items.map((item) => [
            item.sku_id,
            item.unit_price_amount,
          ]),
        );

        // Directly update each field using setValue
        currentLineItems.forEach((lineItem, index) => {
          if (lineItem.sku?.id) {
            const newPrice = priceMap.get(lineItem.sku.id);

            if (newPrice !== undefined) {
              // Use setValue with the exact path
              form.setValue(`line_items.${index}.unit_price_amount`, newPrice);
            }
          }
        });

        toast({
          title: "Prices Redistributed",
          description: "Line item prices have been updated.",
        });
      } else {
        throw new Error("Invalid response received from server.");
      }
    } catch (err) {
      console.error("Failed to redistribute prices:", err);
      toast({
        title: "Redistribution Failed",
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  // Determine loading state
  const isLoadingState = isLoading || (!transaction && !error);

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

  const totalAmount =
    isEditing && fields.length > 0
      ? fields.reduce(
          (sum, item) =>
            sum + Number((item.unit_price_amount * item.quantity).toFixed(2)),
          0,
        )
      : transaction?.line_items.reduce(
          (sum, item) =>
            sum + Number((item.unit_price_amount * item.quantity).toFixed(2)),
          0,
        ) || 0;

  const currency = transaction?.currency || "USD";

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-row justify-between items-center">
        {isLoadingState ? (
          <Skeleton className="h-8 w-[400px]" />
        ) : (
          <CardTitle>
            {transaction?.type === "PURCHASE"
              ? `${Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: currency,
                }).format(
                  totalAmount,
                )} purchase from ${transaction!.counterparty_name}`
              : `${Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: currency,
                }).format(
                  totalAmount,
                )} sale to ${transaction!.counterparty_name}`}
          </CardTitle>
        )}
        {isLoadingState ? (
          <Skeleton className="h-9 w-24" />
        ) : isEditing ? (
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                form.reset();
              }}
              disabled={isMutating || isCalculating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={form.handleSubmit(handleSaveChanges)}
              type="submit"
              disabled={isMutating || isCalculating}
            >
              {isMutating ? "Saving..." : "Save Changes"}
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
      </div>

      {/* Main content */}
      <div>
        <Form {...form}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information Card */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Overview of this transaction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date */}
                  {isLoadingState ? (
                    <InputLoading />
                  ) : (
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          {isEditing ? (
                            <FormControl>
                              <DatePickerInput
                                value={
                                  field.value
                                    ? new Date(field.value)
                                    : undefined
                                }
                                onChange={(date) =>
                                  field.onChange(date ? date.toISOString() : "")
                                }
                                dateFormat="MMMM d, yyyy"
                                className="w-full"
                                disabled={false}
                                clearable={true}
                              />
                            </FormControl>
                          ) : (
                            <div className="mt-2">
                              {format(
                                new Date(transaction!.date),
                                "MMMM d, yyyy",
                              )}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  )}
                  {/* Counterparty Name */}
                  {isLoadingState ? (
                    <InputLoading />
                  ) : (
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
                              {transaction!.counterparty_name}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  )}
                  {/* Comment */}
                  {isLoadingState ? (
                    <InputLoading />
                  ) : (
                    <FormField
                      control={form.control}
                      name="comment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comment</FormLabel>
                          {isEditing ? (
                            <>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value ?? ""}
                                  className="resize-none h-20"
                                  placeholder="Add a comment"
                                />
                              </FormControl>
                              <FormMessage />
                            </>
                          ) : (
                            <div className="mt-2">
                              {transaction!.comment ? (
                                <span className="whitespace-pre-wrap max-w-[300px] block truncate">
                                  {transaction!.comment}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  No comment
                                </span>
                              )}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order Details Card */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>
                  Financial breakdown of this transaction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Platform select */}
                  {isLoadingState ? (
                    <InputLoading />
                  ) : (
                    <FormFieldPlatformSelect
                      control={form.control}
                      name="platform_id"
                      label="Platform"
                      isEditing={isEditing}
                      displayValue={transaction?.platform?.name}
                    />
                  )}
                  {/* Platform Order ID */}
                  {isLoadingState ? (
                    (isEditing && selectedPlatformId) ||
                    (!isEditing && transaction?.platform_order_id) ? (
                      <InputLoading />
                    ) : null
                  ) : (
                    <>
                      {isEditing && selectedPlatformId && (
                        <FormField
                          control={form.control}
                          name="platform_order_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Order ID</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder="Order ID"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {!isEditing && transaction?.platform_order_id && (
                        <div>
                          <div className="text-sm font-medium mb-2">
                            Order ID
                          </div>
                          <div className="mt-2">
                            {transaction.platform_order_id}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* Shipping Cost */}
                  {isLoadingState ? (
                    <InputLoading />
                  ) : (
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
                                  value={field.value}
                                  onChange={field.onChange}
                                  className="w-full"
                                />
                              </FormControl>
                              <FormMessage />
                            </>
                          ) : (
                            <div className="mt-2">
                              {Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: transaction!.currency,
                              }).format(transaction!.shipping_cost_amount)}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  )}
                  {/* Tax Amount */}
                  {isLoadingState ? (
                    <InputLoading />
                  ) : (
                    <FormField
                      control={form.control}
                      name="tax_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Amount</FormLabel>
                          {isEditing ? (
                            <>
                              <FormControl>
                                <MoneyInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  className="w-full"
                                />
                              </FormControl>
                              <FormMessage />
                            </>
                          ) : (
                            <div className="mt-2">
                              {Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: transaction!.currency,
                              }).format(transaction!.tax_amount)}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Line Items Section */}
          <div className="flex justify-between items-center mt-4 mb-4">
            {isEditing && !isLoadingState && (
              <>
                <SelectProductDialog onSelect={onProductSelected} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRedistributePrices}
                  disabled={isCalculating}
                >
                  {isCalculating ? "Redistributing..." : "Redistribute Prices"}
                </Button>
              </>
            )}
          </div>
          <DataTable
            columns={lineItemColumns}
            data={fields}
            loading={isLoadingState}
          />
        </Form>
      </div>
    </div>
  );

  // Function to handle product selection
  function onProductSelected(product: ProductWithSetAndSKUsResponse) {
    // Default to the first SKU in the product
    if (product.skus && product.skus.length > 0) {
      const selectedSku = product.skus[0];
      // Create a new line item with the selected product
      prepend({
        // This will be treated as a new line item when saving
        id: undefined,
        sku: {
          id: selectedSku.id,
          condition: selectedSku.condition,
          printing: selectedSku.printing,
          language: selectedSku.language,
          product: product,
        },
        quantity: 1,
        unit_price_amount: 0, // Default to 0, user will need to set the price
      });
    }

    setIsSelectProductDialogOpen(false);
  }
}
