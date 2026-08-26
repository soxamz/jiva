import type * as React from 'react';

import { Card } from '@/components/ui/card';

export function DashboardCard(props: React.ComponentProps<typeof Card>) {
  return <Card {...props} />;
}
