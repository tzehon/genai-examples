import React, { useMemo } from 'react';
import { useSocket } from './hooks/useSocket';
import { useTestState } from './hooks/useTestState';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ClusterTopology } from './components/ClusterTopology';
import { ScenarioSelector } from './components/ScenarioSelector';
import { ProfileConfig } from './components/ProfileConfig';
import { ControlPanel } from './components/ControlPanel';
import { OperationsFeed } from './components/OperationsFeed';
import { MetricsPanel } from './components/MetricsPanel';
import { TestResults } from './components/TestResults';
import { WhatToChange } from './components/WhatToChange';

export const App: React.FC = () => {
  const socket = useSocket();
  const testState = useTestState();

  const handleStartTest = () => {
    const config = testState.getTestConfig();
    socket.startTest(config);
  };

  const handleStopTest = () => {
    socket.stopTest();
  };

  // Compute live metrics from operations + persisted failures
  const liveMetrics = useMemo(() => {
    return testState.computeMetrics(socket.operations, socket.failedOperations);
  }, [socket.operations, socket.failedOperations, testState]);

  // Use test results metrics if available, otherwise live metrics
  const displayMetrics = socket.testResults?.metrics || liveMetrics;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">MongoDB Atlas Failover Tester</h1>
              <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                Zero-downtime Demo
              </span>
            </div>
            <ConnectionStatus connected={socket.connected} />
          </div>
        </div>
      </header>

      {/* Primary Change Alert Banner */}
      {socket.failoverComplete && socket.oldPrimary && socket.newPrimary && (
        <div className="bg-green-500 text-white py-3 px-4 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
            <span className="text-2xl">⚡</span>
            <div className="text-center">
              <div className="font-bold text-lg">PRIMARY CHANGED!</div>
              <div className="text-sm">
                <span className="opacity-75">{socket.oldPrimary.split('.')[0]}</span>
                <span className="mx-2">→</span>
                <span className="font-bold">{socket.newPrimary.split('.')[0]}</span>
                <span className="ml-2 opacity-75">({socket.electionTimer.toFixed(1)}s)</span>
              </div>
            </div>
            <span className="text-2xl">⚡</span>
          </div>
        </div>
      )}

      {/* Election In Progress Alert Banner */}
      {socket.failoverDetected && !socket.failoverComplete && (
        <div className="bg-red-600 text-white py-3 px-4 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
            <span className="text-2xl">🔴</span>
            <div className="text-center">
              <div className="font-bold text-lg">ELECTION IN PROGRESS!</div>
              <div className="text-sm">
                Primary down: <span className="font-mono">{socket.oldPrimary?.split('.')[0]}</span>
                <span className="ml-2">— Electing new primary...</span>
              </div>
            </div>
            <span className="text-2xl">🔴</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Error Display */}
        {socket.error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-400">Error:</span>
              <span className="text-gray-300">{socket.error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Configuration */}
          <div className="col-span-4 space-y-6">
            <ScenarioSelector
              scenario={testState.scenario}
              onChange={testState.setScenario}
              disabled={socket.testRunning}
            />

            <ProfileConfig
              scenario={testState.scenario}
              customSettings={testState.customSettings}
              onCustomSettingsChange={testState.setCustomSettings}
              disabled={socket.testRunning}
            />

            <ControlPanel
              testRunning={socket.testRunning}
              connected={socket.connected}
              testDuration={testState.testDuration}
              onTestDurationChange={testState.setTestDuration}
              onStart={handleStartTest}
              onStop={handleStopTest}
            />

            <ClusterTopology
              status={socket.clusterStatus}
              failoverTriggered={socket.failoverTriggered}
              failoverDetected={socket.failoverDetected}
              failoverComplete={socket.failoverComplete}
              electionTimer={socket.electionTimer}
              oldPrimary={socket.oldPrimary}
              newPrimary={socket.newPrimary}
              clusterEvents={socket.clusterEvents}
            />
          </div>

          {/* Right Column - Operations & Results */}
          <div className="col-span-8 space-y-6">
            {/* Test Results (shown when test completes) */}
            {socket.testResults && (
              <TestResults
                results={socket.testResults}
                onClear={socket.clearResults}
              />
            )}

            {/* Live Operations Feed */}
            <OperationsFeed
              operations={socket.operations}
              failedOperations={socket.failedOperations}
              scenario={testState.scenario}
            />

            {/* Metrics Panel */}
            <MetricsPanel
              metrics={displayMetrics}
              scenario={testState.scenario}
            />

            {/* What To Change Panel */}
            <WhatToChange />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>
              Demonstrating that MongoDB driver defaults are already resilient.
              Failures happen when you override them incorrectly.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
