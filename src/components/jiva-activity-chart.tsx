'use client';

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

type ActivityRow = {
  day: string;
  documents: number;
  intakes: number;
};

const chartConfig = {
  documents: {
    label: 'Documents',
    color: 'var(--chart-2)',
  },
  intakes: {
    label: 'Intakes',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function JivaActivityChart({ rows }: { rows: ActivityRow[] }) {
  return (
    <ChartContainer className="aspect-auto h-60 w-full md:h-72" config={chartConfig}>
      <BarChart accessibilityLayer data={rows}>
        <CartesianGrid className="stroke-border" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="day"
          interval={0}
          tickFormatter={(value) => String(value)}
          tickLine={false}
          tickMargin={10}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
        <Bar dataKey="documents" fill="var(--color-documents)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="intakes" fill="var(--color-intakes)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
