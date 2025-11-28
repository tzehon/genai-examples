import React from 'react';

interface ControlPanelProps {
  testRunning: boolean;
  connected: boolean;
  testDuration: number;
  onTestDurationChange: (duration: number) => void;
  onStart: () => void;
  onStop: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  testRunning,
  connected,
  testDuration,
  onTestDurationChange,
  onStart,
  onStop,
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Test Control</h3>

      <div className="space-y-4">
        {/* Duration Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Test Duration</label>
          <select
            value={testDuration}
            onChange={(e) => onTestDurationChange(parseInt(e.target.value))}
            disabled={testRunning}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-50"
          >
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
            <option value={360}>6 minutes (recommended)</option>
            <option value={480}>8 minutes</option>
            <option value={600}>10 minutes</option>
          </select>
        </div>

        {/* Start/Stop Button */}
        {!testRunning ? (
          <button
            onClick={onStart}
            disabled={!connected}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
              connected
                ? 'bg-green-600 hover:bg-green-500 active:bg-green-700'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            {connected ? 'Start Failover Test' : 'Not Connected'}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="w-full py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 transition-all"
          >
            Stop Test
          </button>
        )}

        {/* Test Info */}
        {testRunning && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Test Running
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
