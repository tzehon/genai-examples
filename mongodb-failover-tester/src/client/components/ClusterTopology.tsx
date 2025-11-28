import React, { useRef, useEffect } from 'react';
import type { ClusterStatus } from '../types';
import type { ClusterEvent } from '../hooks/useSocket';

interface ClusterTopologyProps {
  status: ClusterStatus | null;
  failoverTriggered: boolean;
  failoverDetected: boolean;
  failoverComplete: boolean;
  electionTimer: number;
  oldPrimary: string | null;
  newPrimary: string | null;
  clusterEvents: ClusterEvent[];
}

const formatEventTime = (date: Date): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const ClusterTopology: React.FC<ClusterTopologyProps> = ({
  status,
  failoverTriggered,
  failoverDetected,
  failoverComplete,
  electionTimer,
  oldPrimary,
  newPrimary,
  clusterEvents,
}) => {
  const eventsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (eventsRef.current) {
      eventsRef.current.scrollTop = eventsRef.current.scrollHeight;
    }
  }, [clusterEvents]);
  const waitingForAtlas = failoverTriggered && !failoverDetected && !failoverComplete;
  const electionInProgress = failoverDetected && !failoverComplete;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Cluster Topology</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status?.state === 'HEALTHY'
                ? 'bg-green-500'
                : status?.state === 'FAILOVER_IN_PROGRESS'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-gray-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {status?.state || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Waiting for Atlas to execute */}
      {waitingForAtlas && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-blue-400 font-medium">Failover requested</span>
              <p className="text-xs text-gray-400 mt-1">Waiting for Atlas to execute (3-5 min)...</p>
            </div>
            <span className="text-2xl font-mono text-blue-400">
              {electionTimer.toFixed(0)}s
            </span>
          </div>
        </div>
      )}

      {/* Election in progress */}
      {electionInProgress && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-yellow-400 font-medium">Election in progress!</span>
              <p className="text-xs text-gray-400 mt-1">Primary is down, waiting for new primary...</p>
            </div>
            <span className="text-2xl font-mono text-yellow-400">
              {electionTimer.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {failoverComplete && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 font-medium">Election complete!</span>
            <span className="text-2xl font-mono text-green-400">
              {electionTimer.toFixed(1)}s
            </span>
          </div>
          {oldPrimary && newPrimary && (
            <div className="text-xs text-gray-300 flex items-center gap-2">
              <span className="font-mono text-red-400">{oldPrimary.split('.')[0]}</span>
              <span className="text-gray-500">→</span>
              <span className="font-mono text-green-400">{newPrimary.split('.')[0]}</span>
            </div>
          )}
        </div>
      )}

      {/* Cluster Nodes */}
      <div className="grid grid-cols-3 gap-3">
        {/* Primary */}
        <div
          className={`p-3 rounded-lg border-2 text-center transition-all duration-500 ${
            status?.primary
              ? 'border-green-500 bg-green-500/10'
              : 'border-gray-600 bg-gray-700/50'
          } ${electionInProgress ? 'animate-pulse' : ''}`}
        >
          <div className="text-xs text-gray-400 mb-1">PRIMARY</div>
          <div className="text-xs font-mono text-white break-all">
            {status?.primary?.hostname?.split('.').slice(0, 2).join('.') || '---'}
          </div>
          {status?.primary && (
            <div className="mt-1 w-3 h-3 mx-auto rounded-full bg-green-500" />
          )}
        </div>

        {/* Secondaries */}
        {[0, 1].map((idx) => {
          const secondary = status?.secondaries?.[idx];
          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border-2 text-center ${
                secondary
                  ? 'border-gray-500 bg-gray-700/30'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <div className="text-xs text-gray-400 mb-1">SECONDARY</div>
              <div className="text-xs font-mono text-white break-all">
                {secondary?.hostname?.split('.').slice(0, 2).join('.') || '---'}
              </div>
              {secondary && (
                <div className="mt-1 w-3 h-3 mx-auto rounded-full bg-gray-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Cluster Name */}
      <div className="mt-3 text-center text-xs text-gray-500">
        {status?.clusterName || 'Not connected'}
      </div>

      {/* Event Stream */}
      {clusterEvents.length > 0 && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Event Log</h4>
          <div
            ref={eventsRef}
            className="h-32 overflow-y-auto space-y-1 bg-gray-900/50 rounded p-2"
          >
            {clusterEvents.map((event) => (
              <div
                key={event.id}
                className={`text-xs p-1.5 rounded flex items-start gap-2 ${
                  event.type === 'error'
                    ? 'bg-red-500/20 border border-red-500/30'
                    : event.type === 'warning'
                    ? 'bg-yellow-500/20 border border-yellow-500/30'
                    : event.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30'
                    : 'bg-gray-700/50'
                }`}
              >
                <span className="text-gray-500 font-mono shrink-0">
                  {formatEventTime(event.timestamp)}
                </span>
                <span
                  className={`${
                    event.type === 'error'
                      ? 'text-red-300'
                      : event.type === 'warning'
                      ? 'text-yellow-300'
                      : event.type === 'success'
                      ? 'text-green-300'
                      : 'text-gray-300'
                  }`}
                >
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
