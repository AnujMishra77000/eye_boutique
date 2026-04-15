import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getRevenueSummary, getRevenueTimeseries } from "@/features/analytics/api";
import { getErrorMessage } from "@/lib/errors";
import type { RevenueRange } from "@/types/analytics";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

export function AnalyticsPage() {
  const [range, setRange] = useState<RevenueRange>("last_30_days");

  const summaryQuery = useQuery({
    queryKey: ["analytics-revenue-summary", range],
    queryFn: () => getRevenueSummary(range)
  });

  const timeseriesQuery = useQuery({
    queryKey: ["analytics-revenue-timeseries", range],
    queryFn: () => getRevenueTimeseries(range)
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-100">Revenue Analytics</h2>
        <p className="mt-1 text-sm text-slate-400">Track confirmed billing performance with daily trend visibility.</p>
      </section>

      <section className="rounded-2xl border border-pink-400/20 bg-matte-850/85 p-5 shadow-neon-ring">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setRange("today")}
              className={`rounded-md border px-3 py-1 ${
                range === "today"
                  ? "border-pink-400/35 bg-pink-500/15 text-pink-200"
                  : "border-pink-400/20 text-slate-300"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setRange("last_7_days")}
              className={`rounded-md border px-3 py-1 ${
                range === "last_7_days"
                  ? "border-pink-400/35 bg-pink-500/15 text-pink-200"
                  : "border-pink-400/20 text-slate-300"
              }`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => setRange("last_30_days")}
              className={`rounded-md border px-3 py-1 ${
                range === "last_30_days"
                  ? "border-pink-400/35 bg-pink-500/15 text-pink-200"
                  : "border-pink-400/20 text-slate-300"
              }`}
            >
              Last 30 days
            </button>
          </div>

          {summaryQuery.data && (
            <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-3">
              <div className="rounded-md border border-pink-400/20 bg-matte-800/60 px-3 py-2">
                <p className="text-slate-400">Total Revenue</p>
                <p className="text-sm font-semibold text-pink-200">{formatCurrency(summaryQuery.data.total_revenue)}</p>
              </div>
              <div className="rounded-md border border-pink-400/20 bg-matte-800/60 px-3 py-2">
                <p className="text-slate-400">Total Bills</p>
                <p className="text-sm font-semibold text-pink-200">{summaryQuery.data.total_bills}</p>
              </div>
              <div className="rounded-md border border-pink-400/20 bg-matte-800/60 px-3 py-2">
                <p className="text-slate-400">Average Bill Value</p>
                <p className="text-sm font-semibold text-pink-200">{formatCurrency(summaryQuery.data.average_bill_value)}</p>
              </div>
            </div>
          )}
        </div>

        {summaryQuery.isError && <p className="mb-3 text-sm text-rose-400">{getErrorMessage(summaryQuery.error)}</p>}
        {timeseriesQuery.isError && <p className="mb-3 text-sm text-rose-400">{getErrorMessage(timeseriesQuery.error)}</p>}

        <div className="h-[360px] w-full">
          <ResponsiveContainer>
            <AreaChart data={timeseriesQuery.data?.points ?? []}>
              <defs>
                <linearGradient id="analyticsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1ea9ff" stopOpacity={0.62} />
                  <stop offset="100%" stopColor="#1ea9ff" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#1f2b3d" />
              <XAxis dataKey="label" stroke="#96a2b8" />
              <YAxis stroke="#96a2b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121821",
                  border: "1px solid rgba(30, 169, 255, 0.35)",
                  borderRadius: 12,
                  color: "#e2e8f0"
                }}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#56beff"
                strokeWidth={2}
                fill="url(#analyticsRevenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {(summaryQuery.isLoading || timeseriesQuery.isLoading) && (
          <p className="mt-3 text-xs text-slate-400">Refreshing analytics...</p>
        )}
      </section>
    </div>
  );
}
