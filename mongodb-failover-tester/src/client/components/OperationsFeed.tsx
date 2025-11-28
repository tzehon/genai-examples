import React, { useRef, useEffect } from 'react';
import type { OperationResult, ScenarioType } from '../types';

interface OperationsFeedProps {
  operations: OperationResult[];
  failedOperations: OperationResult[];  // Persisted failed ops
  scenario: ScenarioType;
}

const formatTime = (date: Date): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

const getLatencyClass = (latency: number, success: boolean): string => {
  if (!success) return 'text-red-400';
  if (latency < 100) return 'text-green-400';
  if (latency < 500) return 'text-yellow-400';
  return 'text-red-400';
};

interface OperationColumnProps {
  title: string;
  operations: OperationResult[];
  type: 'write' | 'read';
  variant: 'resilient' | 'fragile' | 'custom';
}

const OperationColumn: React.FC<OperationColumnProps> = ({
  title,
  operations,
  type,
  variant,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [operations]);

  const filtered = operations
    .filter((op) => op.profile === variant && op.type === type)
    .slice(-50);

  const borderColor =
    variant === 'resilient'
      ? 'border-green-500/30'
      : variant === 'fragile'
      ? 'border-red-500/30'
      : 'border-blue-500/30';

  return (
    <div className={`bg-gray-900 rounded-lg border ${borderColor} overflow-hidden`}>
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
      </div>
      <div ref={scrollRef} className="h-48 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">
            No operations yet
          </div>
        ) : (
          filtered.map((op, idx) => (
            <div
              key={idx}
              className={`operation-entry ${
                op.success ? 'operation-success' : 'operation-failure'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500">{formatTime(op.timestamp)}</span>
                <span>{op.success ? '✓' : '✗'}</span>
                <span className={getLatencyClass(op.latency, op.success)}>
                  {op.latency}ms
                </span>
              </div>
              {op.error && (
                <div className="text-red-400 text-xs truncate mt-0.5">
                  {op.error.split(':')[0]}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const OperationsFeed: React.FC<OperationsFeedProps> = ({
  operations,
  failedOperations,
  scenario,
}) => {
  const showResilient = scenario === 'compare' || scenario === 'resilient';
  const showFragile = scenario === 'compare' || scenario === 'fragile';
  const showCustom = scenario === 'custom';

  const gridCols = scenario === 'compare' ? 'grid-cols-4' : 'grid-cols-2';

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Live Operations</h3>

      <div className={`grid ${gridCols} gap-3`}>
        {showResilient && (
          <>
            <OperationColumn
              title="Resilient - Writes"
              operations={operations}
              type="write"
              variant="resilient"
            />
            <OperationColumn
              title="Resilient - Reads"
              operations={operations}
              type="read"
              variant="resilient"
            />
          </>
        )}
        {showFragile && (
          <>
            <OperationColumn
              title="Fragile - Writes"
              operations={operations}
              type="write"
              variant="fragile"
            />
            <OperationColumn
              title="Fragile - Reads"
              operations={operations}
              type="read"
              variant="fragile"
            />
          </>
        )}
        {showCustom && (
          <>
            <OperationColumn
              title="Custom - Writes"
              operations={operations}
              type="write"
              variant="custom"
            />
            <OperationColumn
              title="Custom - Reads"
              operations={operations}
              type="read"
              variant="custom"
            />
          </>
        )}
      </div>

      {/* Failed Operations Log - Persisted, never trimmed */}
      {failedOperations.length > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <span>Failed Operations (Persisted)</span>
            <span className="px-2 py-0.5 bg-red-500/20 rounded text-xs">
              {failedOperations.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {failedOperations.map((op, idx) => (
              <div
                key={idx}
                className="p-2 bg-gray-900/50 rounded text-xs border border-red-500/20"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    op.profile === 'resilient'
                      ? 'bg-green-500/20 text-green-400'
                      : op.profile === 'fragile'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {op.profile.toUpperCase()}
                  </span>
                  <span className="text-gray-400">{op.type}</span>
                  <span className="text-gray-500">{formatTime(op.timestamp)}</span>
                  <span className="text-yellow-400">{op.latency}ms</span>
                </div>
                {op.error && (
                  <div className="text-red-300 font-mono break-all">
                    {op.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
