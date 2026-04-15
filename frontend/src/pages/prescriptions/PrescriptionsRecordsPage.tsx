import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { searchCustomers } from "@/features/customers/api";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import {
  createPrescription,
  deletePrescription,
  generatePrescriptionPdf,
  listPrescriptions,
  sendPrescriptionToVendor,
  updatePrescription
} from "@/features/prescriptions/api";
import { listVendors } from "@/features/vendors/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorMessage } from "@/lib/errors";
import type { Prescription, PrescriptionPayload } from "@/types/prescription";

const optionalDecimal = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  },
  z.number({ invalid_type_error: "Enter a valid number" }).nullable()
);

const optionalAxis = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  },
  z
    .number({ invalid_type_error: "Axis must be a number" })
    .int("Axis must be an integer")
    .min(0, "Axis must be between 0 and 180")
    .max(180, "Axis must be between 0 and 180")
    .nullable()
);

const prescriptionFormSchema = z.object({
  customer_id: z.coerce.number().int().positive("Select a customer"),
  prescription_date: z.string().min(1, "Prescription date is required"),
  right_sph: optionalDecimal,
  right_cyl: optionalDecimal,
  right_axis: optionalAxis,
  right_vn: z.string().max(20, "Max length is 20 characters").optional(),
  left_sph: optionalDecimal,
  left_cyl: optionalDecimal,
  left_axis: optionalAxis,
  left_vn: z.string().max(20, "Max length is 20 characters").optional(),
  fh: z.string().max(32, "Max length is 32 characters").optional(),
  add_power: optionalDecimal,
  pd: optionalDecimal,
  notes: z.string().optional()
});

type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;

const defaultValues: PrescriptionFormValues = {
  customer_id: 0,
  prescription_date: "",
  right_sph: null,
  right_cyl: null,
  right_axis: null,
  right_vn: "",
  left_sph: null,
  left_cyl: null,
  left_axis: null,
  left_vn: "",
  fh: "",
  add_power: null,
  pd: null,
  notes: ""
};

function resolveMediaUrl(rawUrl: string): string {
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

export function PrescriptionsRecordsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUserQuery = useCurrentUser();
  const canEditOrDeletePrescriptions = currentUserQuery.data?.role === "admin";

  const [page, setPage] = useState(1);
  const [customerBusinessIdFilter, setCustomerBusinessIdFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");

  const debouncedBusinessIdFilter = useDebouncedValue(customerBusinessIdFilter, 300);
  const debouncedContactFilter = useDebouncedValue(contactFilter, 300);

  const [customerLookup, setCustomerLookup] = useState("");
  const debouncedCustomerLookup = useDebouncedValue(customerLookup, 300);
  const [prefillApplied, setPrefillApplied] = useState(false);

  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);

  const [vendorModalPrescription, setVendorModalPrescription] = useState<Prescription | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<number>(0);
  const [vendorCaption, setVendorCaption] = useState("");

  const prescriptionsQuery = useQuery({
    queryKey: ["prescriptions", page, debouncedBusinessIdFilter, debouncedContactFilter],
    queryFn: () =>
      listPrescriptions({
        page,
        page_size: 10,
        customer_business_id: debouncedBusinessIdFilter || undefined,
        contact_no: debouncedContactFilter || undefined
      })
  });

  const customerLookupQuery = useQuery({
    queryKey: ["customer-lookup", debouncedCustomerLookup],
    queryFn: () => searchCustomers(debouncedCustomerLookup, 1, 15),
    enabled: debouncedCustomerLookup.length >= 2
  });

  const activeVendorsQuery = useQuery({
    queryKey: ["vendors-active-for-prescriptions"],
    queryFn: () => listVendors({ page: 1, page_size: 100, is_active: true }),
    enabled: vendorModalPrescription !== null
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues
  });

  useEffect(() => {
    if (!editingPrescription) {
      reset(defaultValues);
      return;
    }

    setCustomerLookup(editingPrescription.customer_business_id ?? "");

    reset({
      customer_id: editingPrescription.customer_id,
      prescription_date: editingPrescription.prescription_date,
      right_sph: editingPrescription.right_sph,
      right_cyl: editingPrescription.right_cyl,
      right_axis: editingPrescription.right_axis,
      right_vn: editingPrescription.right_vn ?? "",
      left_sph: editingPrescription.left_sph,
      left_cyl: editingPrescription.left_cyl,
      left_axis: editingPrescription.left_axis,
      left_vn: editingPrescription.left_vn ?? "",
      fh: editingPrescription.fh ?? "",
      add_power: editingPrescription.add_power,
      pd: editingPrescription.pd,
      notes: editingPrescription.notes ?? ""
    });
  }, [editingPrescription, reset]);

  useEffect(() => {
    if (prefillApplied || editingPrescription !== null) {
      return;
    }

    const customerIdRaw = searchParams.get("customer_id");
    const customerQuery = (searchParams.get("customer_query") ?? "").trim();
    const contactNo = (searchParams.get("contact_no") ?? "").trim();

    let didApply = false;

    if (customerQuery.length > 0) {
      setCustomerBusinessIdFilter(customerQuery);
      setCustomerLookup(customerQuery);
      didApply = true;
    }

    if (contactNo.length > 0) {
      setContactFilter(contactNo);
      didApply = true;
    }

    if (customerIdRaw) {
      const customerId = Number(customerIdRaw);
      if (Number.isFinite(customerId) && customerId > 0) {
        setValue("customer_id", customerId, { shouldValidate: true, shouldDirty: true });
        didApply = true;
      }
    }

    if (didApply) {
      setPage(1);
      const next = new URLSearchParams(searchParams);
      next.delete("customer_id");
      next.delete("customer_query");
      next.delete("contact_no");
      setSearchParams(next, { replace: true });
      setPrefillApplied(true);
    }
  }, [editingPrescription, prefillApplied, searchParams, setSearchParams, setValue]);

  const createMutation = useMutation({
    mutationFn: createPrescription,
    onSuccess: () => {
      toast.success("Prescription created");
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      setEditingPrescription(null);
      reset(defaultValues);
      setCustomerLookup("");
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PrescriptionPayload> }) => updatePrescription(id, payload),
    onSuccess: () => {
      toast.success("Prescription updated");
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      setEditingPrescription(null);
      reset(defaultValues);
      setCustomerLookup("");
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: deletePrescription,
    onSuccess: () => {
      toast.success("Prescription deleted");
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const generatePdfMutation = useMutation({
    mutationFn: generatePrescriptionPdf,
    onSuccess: (response) => {
      toast.success("Prescription PDF generated");
      window.open(resolveMediaUrl(response.pdf_url), "_blank", "noopener,noreferrer");
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const sendVendorMutation = useMutation({
    mutationFn: ({ prescriptionId, vendorId, caption }: { prescriptionId: number; vendorId: number; caption?: string }) =>
      sendPrescriptionToVendor(prescriptionId, { vendor_id: vendorId, caption }),
    onSuccess: (response) => {
      toast.success(response.message || "Prescription sent to vendor");
      setVendorModalPrescription(null);
      setSelectedVendorId(0);
      setVendorCaption("");
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const totalPages = useMemo(() => {
    if (!prescriptionsQuery.data) return 1;
    return Math.max(1, Math.ceil(prescriptionsQuery.data.total / prescriptionsQuery.data.page_size));
  }, [prescriptionsQuery.data]);

  const onSubmit = (values: PrescriptionFormValues) => {
    const payload = {
      ...values,
      right_vn: values.right_vn || null,
      left_vn: values.left_vn || null,
      fh: values.fh || null,
      notes: values.notes || null
    };

    if (editingPrescription && canEditOrDeletePrescriptions) {
      updateMutation.mutate({ id: editingPrescription.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section className="order-2 rounded-2xl border border-pink-400/20 bg-matte-850/85 p-5 shadow-neon-ring">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-100">Saved Prescriptions</h2>
            <p className="text-sm text-slate-400">Latest prescriptions appear first. Search by customer code or mobile.</p>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input
              value={customerBusinessIdFilter}
              onChange={(event) => {
                setCustomerBusinessIdFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Filter by Customer ID"
              className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={contactFilter}
              onChange={(event) => {
                setContactFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Filter by Mobile Number"
              className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          {prescriptionsQuery.isLoading && <p className="text-sm text-slate-300">Loading prescriptions...</p>}
          {prescriptionsQuery.isError && <p className="text-sm text-rose-400">{getErrorMessage(prescriptionsQuery.error)}</p>}

          {prescriptionsQuery.data && prescriptionsQuery.data.items.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              No prescriptions found.
            </p>
          )}

          {prescriptionsQuery.data && prescriptionsQuery.data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="border-b border-pink-400/20 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-3 pr-3">Date</th>
                    <th className="py-3 pr-3">Customer</th>
                    <th className="py-3 pr-3">ID</th>
                    <th className="py-3 pr-3">Contact</th>
                    <th className="py-3 pr-3">Right</th>
                    <th className="py-3 pr-3">Left</th>
                    <th className="py-3 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptionsQuery.data.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800/80 text-slate-200">
                      <td className="py-3 pr-3">{new Date(item.prescription_date).toLocaleDateString()}</td>
                      <td className="py-3 pr-3">{item.customer_name || "-"}</td>
                      <td className="py-3 pr-3 font-medium text-pink-200">{item.customer_business_id || "-"}</td>
                      <td className="py-3 pr-3">{item.customer_contact_no || "-"}</td>
                      <td className="py-3 pr-3">
                        {item.right_sph ?? "-"}/{item.right_cyl ?? "-"} axis {item.right_axis ?? "-"}
                      </td>
                      <td className="py-3 pr-3">
                        {item.left_sph ?? "-"}/{item.left_cyl ?? "-"} axis {item.left_axis ?? "-"}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {canEditOrDeletePrescriptions && (
                            <button
                              type="button"
                              onClick={() => setEditingPrescription(item)}
                              className="rounded-md border border-amber-400/30 px-2 py-1 text-xs text-amber-200"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => generatePdfMutation.mutate(item.id)}
                            className="rounded-md border border-pink-400/35 px-2 py-1 text-xs text-pink-200"
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVendorModalPrescription(item);
                              setSelectedVendorId(0);
                              setVendorCaption(
                                `Prescription for ${item.customer_name || "Customer"} (${item.customer_business_id || item.customer_id})`
                              );
                            }}
                            className="rounded-md border border-emerald-400/35 px-2 py-1 text-xs text-emerald-200"
                          >
                            Send Vendor
                          </button>
                          {canEditOrDeletePrescriptions && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Delete this prescription?")) {
                                  deleteMutation.mutate(item.id);
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
                  ))}
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

        <section className="order-1 rounded-2xl border border-pink-400/20 bg-matte-850/85 p-5 shadow-neon-ring">
          <h3 className="text-lg font-semibold text-slate-100">{canEditOrDeletePrescriptions && editingPrescription ? "Edit Prescription" : "Create Prescription"}</h3>

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
                type="date"
                {...register("prescription_date")}
                className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              {errors.prescription_date && <p className="text-xs text-rose-400">{errors.prescription_date.message}</p>}
            </div>

            <p className="pt-1 text-xs uppercase tracking-wide text-slate-400">Right Eye</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                {...register("right_sph")}
                placeholder="Right SPH"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("right_cyl")}
                placeholder="Right CYL"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("right_axis")}
                placeholder="Right Axis"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("right_vn")}
                placeholder="Right VN"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            {(errors.right_axis || errors.right_sph || errors.right_cyl) && (
              <div className="space-y-1 text-xs text-rose-400">
                {errors.right_axis?.message && <p>{errors.right_axis.message}</p>}
                {errors.right_sph?.message && <p>{errors.right_sph.message}</p>}
                {errors.right_cyl?.message && <p>{errors.right_cyl.message}</p>}
              </div>
            )}

            <p className="pt-1 text-xs uppercase tracking-wide text-slate-400">Left Eye</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                {...register("left_sph")}
                placeholder="Left SPH"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("left_cyl")}
                placeholder="Left CYL"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("left_axis")}
                placeholder="Left Axis"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("left_vn")}
                placeholder="Left VN"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            {(errors.left_axis || errors.left_sph || errors.left_cyl) && (
              <div className="space-y-1 text-xs text-rose-400">
                {errors.left_axis?.message && <p>{errors.left_axis.message}</p>}
                {errors.left_sph?.message && <p>{errors.left_sph.message}</p>}
                {errors.left_cyl?.message && <p>{errors.left_cyl.message}</p>}
              </div>
            )}

            <p className="pt-1 text-xs uppercase tracking-wide text-slate-400">Fitting</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                {...register("pd")}
                placeholder="PD"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("add_power")}
                placeholder="ADD Power"
                className="rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
              <input
                {...register("fh")}
                placeholder="FH"
                className="col-span-2 rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            {(errors.pd || errors.add_power || errors.fh) && (
              <div className="space-y-1 text-xs text-rose-400">
                {errors.pd?.message && <p>{errors.pd.message}</p>}
                {errors.add_power?.message && <p>{errors.add_power.message}</p>}
                {errors.fh?.message && <p>{errors.fh.message}</p>}
              </div>
            )}

            <textarea
              {...register("notes")}
              rows={3}
              placeholder="Notes"
              className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-lg border border-pink-300/45 bg-pink-500/15 px-4 py-2 text-sm text-pink-100"
              >
                {canEditOrDeletePrescriptions && editingPrescription ? "Update" : "Create"}
              </button>
              {canEditOrDeletePrescriptions && editingPrescription && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPrescription(null);
                    setCustomerLookup("");
                  }}
                  className="rounded-lg border border-slate-500/50 px-4 py-2 text-sm text-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      </div>

      {vendorModalPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-pink-400/25 bg-matte-900 p-5 shadow-neon-ring">
            <h3 className="text-lg font-semibold text-slate-100">Send Prescription to Vendor</h3>
            <p className="mt-1 text-sm text-slate-400">
              {vendorModalPrescription.customer_name || "Customer"} - {vendorModalPrescription.customer_business_id || "N/A"}
            </p>

            <div className="mt-4 space-y-3">
              <select
                value={selectedVendorId}
                onChange={(event) => setSelectedVendorId(Number(event.target.value))}
                className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              >
                <option value={0}>Select active vendor</option>
                {(activeVendorsQuery.data?.items || []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name} ({vendor.whatsapp_no})
                  </option>
                ))}
              </select>

              {activeVendorsQuery.isLoading && <p className="text-xs text-slate-400">Loading vendors...</p>}
              {activeVendorsQuery.isError && (
                <p className="text-xs text-rose-400">{getErrorMessage(activeVendorsQuery.error)}</p>
              )}

              <textarea
                value={vendorCaption}
                onChange={(event) => setVendorCaption(event.target.value)}
                rows={3}
                placeholder="Optional caption"
                className="w-full rounded-lg border border-pink-400/25 bg-matte-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedVendorId <= 0) {
                    toast.error("Please select an active vendor");
                    return;
                  }
                  sendVendorMutation.mutate({
                    prescriptionId: vendorModalPrescription.id,
                    vendorId: selectedVendorId,
                    caption: vendorCaption || undefined
                  });
                }}
                disabled={sendVendorMutation.isPending}
                className="rounded-lg border border-pink-300/45 bg-pink-500/15 px-4 py-2 text-sm text-pink-100"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => {
                  setVendorModalPrescription(null);
                  setSelectedVendorId(0);
                  setVendorCaption("");
                }}
                className="rounded-lg border border-slate-500/50 px-4 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
