import React from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';

interface DashboardCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  metric?: {
    label: string;
    value: string | number;
  };
  children?: React.ReactNode;
}

export function DashboardCard({
  icon: Icon,
  iconBgColor,
  title,
  description,
  action,
  metric,
  children,
}: DashboardCardProps) {
  const metricPercent = metric ? Math.max(0, Math.min(100, Number.parseFloat(String(metric.value)) || 0)) : 0;

  return (
    <CardContainer className="h-full">
      <CardBody className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-blue-600/30">
        <CardItem translateZ={35} className="mb-4 flex items-start justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgColor}`}>
            <Icon className="h-6 w-6 text-slate-900" />
          </div>
          <button
            type="button"
            aria-label={`Más opciones de ${title}`}
            title={`Más opciones de ${title}`}
            className="text-slate-400 transition-colors hover:text-slate-600"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </CardItem>

        <CardItem translateZ={48} as="h3" className="text-lg font-semibold text-slate-900">
          {title}
        </CardItem>
        <CardItem translateZ={40} as="p" className="mt-1 flex-1 text-sm text-slate-500">
          {description}
        </CardItem>

        {metric && (
          <CardItem translateZ={42} className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">{metric.label}</span>
              <span className="font-semibold text-slate-900">{metric.value}</span>
            </div>
            <progress
              className="h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-blue-600"
              max={100}
              value={metricPercent}
              aria-label={`${metric.label}: ${metric.value}`}
            />
          </CardItem>
        )}

        {children && <CardItem translateZ={30} className="mt-4">{children}</CardItem>}

        {action && (
          <CardItem translateZ={44} className="mt-6">
            <Button
              variant="outline"
              size="sm"
              className="group w-full justify-between"
              onClick={action.onClick}
            >
              {action.label}
              <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardItem>
        )}
      </CardBody>
    </CardContainer>
  );
}
