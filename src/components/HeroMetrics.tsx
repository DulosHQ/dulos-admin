'use client';

interface TrendData {
  value: number;
  isPositive: boolean;
}

interface MetricData {
  label: string;
  value: string;
  trend: TrendData;
  sparkline: number[];
}

interface HeroMetricsProps {
  revenue: MetricData;
  tickets: MetricData;
  occupancy: MetricData;
  upcoming: MetricData;
}

const ACCENT = '#E63946';

const METRIC_ICONS: Record<string, { icon: React.ReactNode }> = {
  'Ingresos del Mes': {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  'Boletos Vendidos': {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  'Ocupación Promedio': {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  'Funciones Próximas': {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
};

const DEFAULT_ICON = {
  icon: (
    <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

function MetricCard({ metric }: { metric: MetricData }) {
  const iconData = METRIC_ICONS[metric.label] || DEFAULT_ICON;

  return (
    <div className="metric-card group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{metric.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{metric.value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-[#E63946]/8 flex items-center justify-center flex-shrink-0">
          {iconData.icon}
        </div>
      </div>
      <p className="text-xs mt-2">
        <span className={metric.trend.isPositive ? 'text-emerald-500 font-semibold' : 'text-red-500 font-semibold'}>
          {metric.trend.isPositive ? '+' : ''}{metric.trend.value}%
        </span>
        <span className="text-gray-400 ml-1">vs periodo anterior</span>
      </p>
    </div>
  );
}

export default function HeroMetrics({ revenue, tickets, occupancy, upcoming }: HeroMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard metric={revenue} />
      <MetricCard metric={tickets} />
      <MetricCard metric={occupancy} />
      <MetricCard metric={upcoming} />
    </div>
  );
}
