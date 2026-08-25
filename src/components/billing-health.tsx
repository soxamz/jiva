import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DashboardCard } from '@/components/dashboard-card';
import { CircleCheckIcon, ArrowRightIcon } from 'lucide-react';

export function BillingHealth() {
  return (
    <DashboardCard className="gap-0">
      <CardHeader className="border-b">
        <CardTitle className="text-base text-balance">Billing health</CardTitle>
        <CardDescription className="text-pretty">
          Nothing urgent needs your attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex h-full items-center px-0">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheckIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>You&apos;re caught up.</EmptyTitle>
            <EmptyDescription className="text-xs">
              Balances and payouts look fine. nothing overdue in this snapshot.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="ghost">
              Review open invoices
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </DashboardCard>
  );
}
