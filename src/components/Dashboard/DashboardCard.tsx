import React from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-blue-600/30">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgColor}`}>
          <Icon className="h-6 w-6 text-slate-900" />
        </div>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-500">{description}</p>

      {/* Metric */}
      {metric && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600">{metric.label}</span>
            <span className="font-semibold text-slate-900">{metric.value}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${metric.value}%` }}
            />
          </div>
        </div>
      )}

      {/* Children (custom content) */}
      {children && <div className="mt-4">{children}</div>}

      {/* Action button */}
      {action && (
        <div className="mt-6">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between group"
            onClick={action.onClick}
          >
            {action.label}
            <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      )}
    </div>
  );
}
