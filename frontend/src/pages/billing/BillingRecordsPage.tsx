import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import {
  createBill,
  deleteBill,
  generateBillPdf,
  getBill,
  listBills,
  sendBillEmail,
  sendBillWhatsapp,
  updateBill
} from "@/features/bills/api";
import { searchCustomers } from "@/features/customers/api";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { calculateBillSummary, sanitizeBillPayloadMoney } from "@/features/bills/calculations";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorMessage } from "@/lib/errors";
import type { Bill, BillPayload } from "@/types/bill";

const billFormSchema = z
  .object({
    customer_id: z.coerce.number().int().positive("Select a customer"),
    product_name: z.string().min(1, "Product name is required").max(255),
    frame_name: z.string().max(255).optional(),
    whole_price: z.coerce.number().min(0, "Whole price must be 0 or greater"),
    discount: z.coerce.number().min(0, "Discount must be 0 or greater"),
    paid_amount: z.coerce.number().min(0, "Paid amount must be 0 or greater"),
    payment_mode: z.enum(["cash", "upi"]),
    delivery_date: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((values, ctx) => {
    const finalPrice = values.whole_price - values.discount;
    if (finalPrice < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount"],
        message: "Discount cannot exceed whole price"
      });
    }

    if (values.paid_amount > finalPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_amount"],
        message: "Paid amount cannot exceed final price"
      });
    }
  });

type BillFormValues = z.infer<typeof billFormSchema>;

const defaultValues: BillFormValues = {
  customer_id: 0,
  product_name: "",
  frame_name: "",
  whole_price: 0,
  discount: 0,
  paid_amount: 0,
  payment_mode: "cash",
  delivery_date: "",
  notes: ""
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function formatDate(value: string | null): string {
  if (value === null || value.length === 0) {
    return "-";
  }
  return new Date(value).toLocaleDateString();
}

function resolvePdfUrl(rawUrl: string): string {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  } catch {
    return rawUrl;
  }
}

export function BillingRecordsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUserQuery = useCurrentUser();
  const canEditOrDeleteBills = currentUserQuery.data?.role === "admin";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const [customerLookup, setCustomerLookup] = useState("");
  const debouncedCustomerLookup = useDebouncedValue(customerLookup, 300);
  const [prefillApplied, setPrefillApplied] = useState(false);

  const billsQuery = useQuery({
    queryKey: ["bills", page, debouncedSearch],
    queryFn: () => listBills({ page, page_size: 10, search: debouncedSearch || undefined })
  });

  const billDetailQuery = useQuery({
    queryKey: ["bill", selectedBillId],
    queryFn: () => getBill(selectedBillId as number),
    enabled: selectedBillId !== null
  });

  const customerLookupQuery = useQuery({
    queryKey: ["bill-customer-lookup", debouncedCustomerLookup],
    queryFn: () => searchCustomers(debouncedCustomerLookup, 1, 15),
    enabled: debouncedCustomerLookup.length >= 2
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues
  });

  const watchedWholePrice = Number(watch("whole_price") || 0);
  const watchedDiscount = Number(watch("discount") || 0);
  const watchedPaidAmount = Number(watch("paid_amount") || 0);

  const billSummary = useMemo(
    () => calculateBillSummary(watchedWholePrice, watchedDiscount, watchedPaidAmount),
    [watchedWholePrice, watchedDiscount, watchedPaidAmount]
  );

  useEffect(() => {
    if (editingBill === null) {
      reset(defaultValues);
      return;
    }

    setCustomerLookup(editingBill.customer_business_id ?? editingBill.customer_name_snapshot);

    reset({
      customer_id: editingBill.customer_id,
      product_name: editingBill.product_name,
      frame_name: editingBill.frame_name ?? "",
      whole_price: Number(editingBill.whole_price),
      discount: Number(editingBill.discount),
      paid_amount: Number(editingBill.paid_amount),
      payment_mode: editingBill.payment_mode,
      delivery_date: editingBill.delivery_date ?? "",
      notes: editingBill.notes ?? ""
    });
  }, [editingBill, reset]);

  useEffect(() => {
    if (prefillApplied || editingBill !== null) {
      return;
    }

    const customerIdRaw = searchParams.get("customer_id");
    if (!customerIdRaw) {
      return;
    }

    const customerId = Number(customerIdRaw);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setPrefillApplied(true);
      return;
    }

    const customerQuery = (searchParams.get("customer_query") ?? "").trim();
    if (customerQuery.length > 0) {
      setCustomerLookup(customerQuery);
    }

    setValue("customer_id", customerId, { shouldValidate: true, shouldDirty: true });

    const next = new URLSearchParams(searchParams);
    next.delete("customer_id");
    next.delete("customer_query");
    setSearchParams(next, { replace: true });
    setPrefillApplied(true);
  }, [editingBill, prefillApplied, searchParams, setSearchParams, setValue]);

  const createMutation = useMutation({
    mutationFn: createBill,
    onSuccess: (bill) => {
      toast.success(bill.pdf_url ? "Bill created and PDF generated" : "Bill created");
      setSelectedBillId(bill.id);
      setEditingBill(null);
      setCustomerLookup("");
      reset(defaultValues);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", bill.id] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const updateMutation = useMutation({
    mutationFn: ({ billId, payload }: { billId: number; payload: Partial<BillPayload> }) => updateBill(billId, payload),
    onSuccess: (bill) => {
      toast.success("Bill updated");
      setSelectedBillId(bill.id);
      setEditingBill(null);
      setCustomerLookup("");
      reset(defaultValues);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", bill.id] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBill,
    onSuccess: () => {
      toast.success("Bill deleted");
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      setSelectedBillId(null);
      setEditingBill(null);
      reset(defaultValues);
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const generatePdfMutation = useMutation({
    mutationFn: generateBillPdf,
    onSuccess: (bill) => {
      toast.success("Bill PDF generated");
      setSelectedBillId(bill.id);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", bill.id] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const sendEmailMutation = useMutation({
    mutationFn: sendBillEmail,
    onSuccess: (response) => {
      toast.success(response.message || "Bill sent on email");
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      if (selectedBillId !== null) {
        queryClient.invalidateQueries({ queryKey: ["bill", selectedBillId] });
      }
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: sendBillWhatsapp,
    onSuccess: (response) => {
      toast.success(response.message || "Bill sent on WhatsApp");
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      if (selectedBillId !== null) {
        queryClient.invalidateQueries({ queryKey: ["bill", selectedBillId] });
      }
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const totalPages = useMemo(() => {
    if (billsQuery.data === undefined) return 1;
    return Math.max(1, Math.ceil(billsQuery.data.total / billsQuery.data.page_size));
  }, [billsQuery.data]);

  const onSubmit = (values: BillFormValues) => {
    const sanitizedMoney = sanitizeBillPayloadMoney({
      whole_price: values.whole_price,
      discount: values.discount,
      paid_amount: values.paid_amount
    });

    const payload: BillPayload = {
      customer_id: values.customer_id,
      product_name: values.product_name,
      frame_name: values.frame_name || null,
      whole_price: sanitizedMoney.whole_price,
      discount: sanitizedMoney.discount,
      paid_amount: sanitizedMoney.paid_amount,
      payment_mode: values.payment_mode,
      delivery_date: values.delivery_date || null,
      notes: values.notes || null
    };

    if (editingBill !== null && canEditOrDeleteBills) {
      updateMutation.mutate({ billId: editingBill.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <section className="order-1 rounded-2xl border border-pink-400/20 bg-matte-850/85 p-5 shadow-neon-ring">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Saved Bills</h2>
            <p className="text-sm text-slate-400">Create invoices, track payment status, and generate bill PDFs.</p>
          </div>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search bill, customer, product, frame, mobile"
            className="w-full max-w-xs rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pink-300"
          />
        </div>

        {billsQuery.isLoading && <p className="text-sm text-slate-300">Loading bills...</p>}
        {billsQuery.isError && <p className="text-sm text-rose-400">{getErrorMessage(billsQuery.error)}</p>}

        {billsQuery.data && billsQuery.data.items.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            No bills found.
          </p>
        )}

        {billsQuery.data && billsQuery.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-pink-400/20 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-3 pr-3">Bill No</th>
                  <th className="py-3 pr-3">Customer</th>
                  <th className="py-3 pr-3">Mobile</th>
                  <th className="py-3 pr-3">Product</th>
                  <th className="py-3 pr-3">Final</th>
                  <th className="py-3 pr-3">Balance</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billsQuery.data.items.map((bill) => {
                  const isSelected = selectedBillId === bill.id;
                  return (
                    <tr
                      key={bill.id}
                      onClick={() => setSelectedBillId(bill.id)}
                      className={`cursor-pointer border-b border-slate-800/80 text-slate-200 ${
                        isSelected ? "bg-pink-500/5" : ""
                      }`}
                    >
                      <td className="py-3 pr-3 font-medium text-pink-200">{bill.bill_number}</td>
                      <td className="py-3 pr-3">{bill.customer_name_snapshot}</td>
                      <td className="py-3 pr-3">{bill.customer_contact_no || "-"}</td>
                      <td className="py-3 pr-3">{bill.product_name}</td>
                      <td className="py-3 pr-3">{formatCurrency(Number(bill.final_price))}</td>
                      <td className="py-3 pr-3">{formatCurrency(Number(bill.balance_amount))}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            bill.payment_status === "paid"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : bill.payment_status === "partial"
                              ? "bg-amber-500/15 text-amber-200"
                              : "bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {bill.payment_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                          {canEditOrDeleteBills && (
                            <button
                              type="button"
                              onClick={() => navigate("/billing/edit/" + bill.id)}
                              className="rounded-md border border-amber-400/30 px-2 py-1 text-xs text-amber-200"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => generatePdfMutation.mutate(bill.id)}
                            className="rounded-md border border-pink-400/30 px-2 py-1 text-xs text-pink-200"
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => sendEmailMutation.mutate(bill.id)}
                            className="rounded-md border border-sky-400/35 px-2 py-1 text-xs text-sky-200"
                          >
                            Email
                          </button>
                          <button
                            type="button"
                            onClick={() => sendWhatsAppMutation.mutate(bill.id)}
                            className="rounded-md border border-emerald-400/35 px-2 py-1 text-xs text-emerald-200"
                          >
                            WhatsApp
                          </button>
                          {canEditOrDeleteBills && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete bill ${bill.bill_number}?`)) {
                                  deleteMutation.mutate(bill.id);
                                }
                              }}
                              className="rounded-md border border-rose-400/35 px-2 py-1 text-xs text-rose-200"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              className="rounded-md border border-pink-400/20 px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              className="rounded-md border border-pink-400/20 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="order-2 space-y-6">
        <div className="rounded-2xl border border-pink-400/20 bg-matte-850/85 p-5 shadow-neon-ring">
          <h3 className="text-lg font-semibold text-slate-100">{canEditOrDeleteBills && editingBill ? "Edit Bill" : "Create Bill"}</h3>

          <div className="mt-3 space-y-2">
            <input
              value={customerLookup}
              onChange={(event) => setCustomerLookup(event.target.value)}
              placeholder="Search customer by ID or contact"
              className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
            />

            <select
              {...register("customer_id")}
              className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value={0}>Select customer</option>
              {(customerLookupQuery.data?.items || []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_id} - {customer.name} ({customer.contact_no})
                </option>
              ))}
            </select>
            {errors.customer_id && <p className="text-xs text-rose-400">{errors.customer_id.message}</p>}
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <input
                {...register("product_name")}
                placeholder="Product Name"
                className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              {errors.product_name && <p className="mt-1 text-xs text-rose-400">{errors.product_name.message}</p>}
            </div>

            <div>
              <input
                {...register("frame_name")}
                placeholder="Frame Name (optional)"
                className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">Total Cost</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("whole_price")}
                  placeholder="Total Cost"
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">Discount</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("discount")}
                  placeholder="Discount"
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">Paid Amount</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("paid_amount")}
                  placeholder="Paid Amount"
                  className="w-full"
                />
              </div>
            </div>

            {(errors.whole_price || errors.discount || errors.paid_amount) && (
              <div className="space-y-1 text-xs text-rose-400">
                {errors.whole_price?.message && <p>{errors.whole_price.message}</p>}
                {errors.discount?.message && <p>{errors.discount.message}</p>}
                {errors.paid_amount?.message && <p>{errors.paid_amount.message}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                {...register("payment_mode")}
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>

              <input
                type="date"
                {...register("delivery_date")}
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <textarea
              {...register("notes")}
              rows={3}
              placeholder="Notes"
              className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
            />

            <div className="rounded-lg border border-pink-400/15 bg-matte-800/70 p-3 text-xs text-slate-300">
              <p className="mb-2 text-[11px] text-slate-300/90">
                Automated formula: (Total Cost - Discount) - Paid Amount
              </p>
              <div className="flex items-center justify-between">
                <span>Total Price After Discount</span>
                <span className="font-semibold text-pink-200">{formatCurrency(billSummary.totalAfterDiscount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Paid Amount</span>
                <span className="font-semibold text-pink-200">{formatCurrency(billSummary.paidAmount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Balance Amount</span>
                <span className="font-semibold text-pink-200">{formatCurrency(billSummary.balanceAmount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Payment Status</span>
                <span className="font-semibold text-pink-200">{billSummary.paymentStatus.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-lg border border-pink-300/45 bg-pink-500/15 px-4 py-2 text-sm text-pink-100"
              >
                {canEditOrDeleteBills && editingBill ? "Update" : "Create"}
              </button>
              {canEditOrDeleteBills && editingBill && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBill(null);
                    setCustomerLookup("");
                  }}
                  className="rounded-lg border border-slate-500/50 px-4 py-2 text-sm text-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-pink-400/20 bg-matte-850/85 p-5 shadow-neon-ring">
          <h3 className="text-lg font-semibold text-slate-100">Bill Detail</h3>
          {selectedBillId === null && <p className="mt-2 text-sm text-slate-400">Select a bill to view details.</p>}
          {billDetailQuery.isLoading && selectedBillId !== null && (
            <p className="mt-2 text-sm text-slate-300">Loading bill details...</p>
          )}
          {billDetailQuery.isError && <p className="mt-2 text-sm text-rose-400">{getErrorMessage(billDetailQuery.error)}</p>}

          {billDetailQuery.data && (
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p className="font-medium text-pink-200">{billDetailQuery.data.bill_number}</p>
              <p>{billDetailQuery.data.customer_name_snapshot}</p>
              <p>Mobile: {billDetailQuery.data.customer_contact_no || "-"}</p>
              <p>{billDetailQuery.data.product_name}</p>
              <p>Whole: {formatCurrency(Number(billDetailQuery.data.whole_price))}</p>
              <p>Discount: {formatCurrency(Number(billDetailQuery.data.discount))}</p>
              <p>Total After Discount: {formatCurrency(Number(billDetailQuery.data.final_price))}</p>
              <p>Paid: {formatCurrency(Number(billDetailQuery.data.paid_amount))}</p>
              <p>Balance: {formatCurrency(Number(billDetailQuery.data.balance_amount))}</p>
              <p>Payment: {billDetailQuery.data.payment_mode.toUpperCase()} / {billDetailQuery.data.payment_status.toUpperCase()}</p>
              <p>Delivery: {formatDate(billDetailQuery.data.delivery_date)}</p>

              <div className="pt-2 flex flex-wrap gap-2">
                {canEditOrDeleteBills && (
                  <button
                    type="button"
                    onClick={() => navigate("/billing/edit/" + billDetailQuery.data.id)}
                    className="rounded-md border border-amber-400/35 px-3 py-1.5 text-xs text-amber-200"
                  >
                    Edit Bill
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => generatePdfMutation.mutate(billDetailQuery.data.id)}
                  className="rounded-md border border-pink-400/35 px-3 py-1.5 text-xs text-pink-200"
                >
                  Regenerate PDF
                </button>

                <button
                  type="button"
                  onClick={() => sendEmailMutation.mutate(billDetailQuery.data.id)}
                  className="rounded-md border border-sky-400/35 px-3 py-1.5 text-xs text-sky-200"
                >
                  Send Email
                </button>

                <button
                  type="button"
                  onClick={() => sendWhatsAppMutation.mutate(billDetailQuery.data.id)}
                  className="rounded-md border border-emerald-400/35 px-3 py-1.5 text-xs text-emerald-200"
                >
                  Send WhatsApp
                </button>

                {billDetailQuery.data.pdf_url && (
                  <a
                    href={resolvePdfUrl(billDetailQuery.data.pdf_url)}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="rounded-md border border-emerald-400/35 px-3 py-1.5 text-xs text-emerald-200"
                  >
                    Download PDF
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
