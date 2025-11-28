import React from 'react';
import type { ProfileMetrics, ScenarioType } from '../types';

interface MetricsPanelProps {
  metrics: Record<string, ProfileMetrics>;
  scenario: ScenarioType;
}

interface ProfileMetricsCardProps {
  title: string;
  metrics: ProfileMetrics;
  variant: 'resilient' | 'fragile' | 'custom';
}

const ProfileMetricsCard: React.FC<ProfileMetricsCardProps> = ({
  title,
  metrics,
  variant,
}) => {
  const borderColor =
    variant === 'resilient'
      ? 'border-green-500/50'
      : variant === 'fragile'
      ? 'border-red-500/50'
      : 'border-blue-500/50';

  const iconColor =
    variant === 'resilient'
      ? 'text-green-400'
      : variant === 'fragile'
      ? 'text-red-400'
      : 'text-blue-400';

  const totalFailures = metrics.failedWrites + metrics.failedReads;
  const totalOps = metrics.totalWrites + metrics.totalReads;
  const successRate = totalOps > 0 ? ((totalOps - totalFailures) / totalOps) * 100 : 0;

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`${iconColor} text-lg`}>
          {variant === 'resilient' ? '✓' : variant === 'fragile' ? '✗' : '◆'}
        </span>
        <h4 className="font-semibold text-white">{title}</h4>
      </div>

      {/* Configuration Settings */}
      {variant === 'resilient' && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-gray-400">timeout:</span>
            <span className="text-green-400 font-mono">30s (default)</span>
            <span className="text-gray-400">retries:</span>
            <span className="text-green-400 font-mono">enabled</span>
          </div>
        </div>
      )}
      {variant === 'fragile' && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-gray-400">timeout:</span>
            <span className="text-red-400 font-mono font-bold">2s (!)</span>
            <span className="text-gray-400">retries:</span>
            <span className="text-red-400 font-mono font-bold">disabled (!)</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Success Rate */}
        <div className="col-span-2 text-center pb-3 border-b border-gray-700">
          <div
            className={`text-3xl font-bold ${
              successRate >= 99
                ? 'text-green-400'
                : successRate >= 90
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}
          >
            {successRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400">Success Rate</div>
        </div>

        {/* Writes */}
        <div>
          <div className="text-xs text-gray-500 mb-1">WRITES</div>
          <div className="text-lg font-mono text-white">
            {metrics.successfulWrites}
            <span className="text-red-400">
              {metrics.failedWrites > 0 && ` / ${metrics.failedWrites} failed`}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Max: {metrics.maxWriteLatency}ms
          </div>
        </div>

        {/* Reads */}
        <div>
          <div className="text-xs text-gray-500 mb-1">READS</div>
          <div className="text-lg font-mono text-white">
            {metrics.successfulReads}
            <span className="text-red-400">
              {metrics.failedReads > 0 && ` / ${metrics.failedReads} failed`}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Max: {metrics.maxReadLatency}ms
          </div>
        </div>
      </div>
    </div>
  );
};

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  scenario,
}) => {
  const showResilient = scenario === 'compare' || scenario === 'resilient';
  const showFragile = scenario === 'compare' || scenario === 'fragile';
  const showCustom = scenario === 'custom';

  const gridCols = scenario === 'compare' ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Live Metrics</h3>

      <div className={`grid ${gridCols} gap-4`}>
        {showResilient && metrics.resilient && (
          <ProfileMetricsCard
            title="RESILIENT"
            metrics={metrics.resilient}
            variant="resilient"
          />
        )}
        {showFragile && metrics.fragile && (
          <ProfileMetricsCard
            title="FRAGILE"
            metrics={metrics.fragile}
            variant="fragile"
          />
        )}
        {showCustom && metrics.custom && (
          <ProfileMetricsCard
            title="CUSTOM"
            metrics={metrics.custom}
            variant="custom"
          />
        )}
      </div>

      {Object.keys(metrics).length === 0 && (
        <div className="text-center text-gray-500 py-8">
          Start a test to see metrics
        </div>
      )}
    </div>
  );
};
