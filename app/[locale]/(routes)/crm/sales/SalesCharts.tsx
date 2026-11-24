"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { euro } from "@/lib/sales/labels";

const amountConfig = {
  amount: {
    label: "Totaal bruto",
    theme: { light: "hsl(183 53% 36%)", dark: "hsl(183 53% 68%)" },
  },
};

function moneyTip(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? euro(amount) : "—";
}

export function RevenueChart({ points }: { points: { label: string; amount: number }[] }) {
  return (
    <ChartContainer config={amountConfig} className="aspect-[16/7] min-h-56 w-full">
      <BarChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value) =>
            new Intl.NumberFormat("nl-BE", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))
          }
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => moneyTip(value)} />} />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={3} maxBarSize={32} />
      </BarChart>
    </ChartContainer>
  );
}
