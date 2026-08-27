import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral';

const toneClasses: Record<StatusTone, string> = {
  success: 'border-clinical-success/30 bg-clinical-success/10 text-clinical-success',
  warning: 'border-clinical-warning/30 bg-clinical-warning/10 text-clinical-warning',
  critical: 'border-clinical-critical/30 bg-clinical-critical/10 text-clinical-critical',
  info: 'border-clinical-info/30 bg-clinical-info/10 text-clinical-info',
  neutral: '',
};

type StatusPillProps = {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
};

export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  return (
    <Badge
      className={cn('rounded-full border px-2.5 py-0.5 font-medium', toneClasses[tone], className)}
      variant={tone === 'neutral' ? 'secondary' : 'outline'}
    >
      {children}
    </Badge>
  );
}
