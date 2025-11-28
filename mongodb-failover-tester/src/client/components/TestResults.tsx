import React from 'react';
import type { TestResults as TestResultsType } from '../types';

interface TestResultsProps {
  results: TestResultsType | null;
  onClear: () => void;
}

export const TestResults: React.FC<TestResultsProps> = ({ results, onClear }) => {
  if (!results) return null;

  const resilientMetrics = results.metrics.resilient;
  const fragileMetrics = results.metrics.fragile;

  const resilientFailed = resilientMetrics
    ? resilientMetrics.failedWrites + resilientMetrics.failedReads
    : 0;
  const fragileFailed = fragileMetrics
    ? fragileMetrics.failedWrites + fragileMetrics.failedReads
    : 0;

  const resilientPassed = resilientMetrics && resilientFailed === 0;
  const fragilePassed = fragileMetrics && fragileFailed === 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-700/50 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Test Results</h3>
        <button
          onClick={onClear}
          className="text-sm text-gray-400 hover:text-white"
        >
          Clear
        </button>
      </div>

      <div className="p-4">
        {/* Results Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {resilientMetrics && (
            <div
              className={`p-4 rounded-lg border-2 ${
                resilientPassed
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-red-500 bg-red-500/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={resilientPassed ? 'text-green-400' : 'text-red-400'}>
                  {resilientPassed ? '✓' : '✗'}
                </span>
                <span className="font-semibold text-white">RESILIENT</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  resilientPassed ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {resilientPassed ? 'PASS' : 'FAIL'}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {resilientFailed} failures
              </div>
            </div>
          )}

          {fragileMetrics && (
            <div
              className={`p-4 rounded-lg border-2 ${
                fragilePassed
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-red-500 bg-red-500/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={fragilePassed ? 'text-green-400' : 'text-red-400'}>
                  {fragilePassed ? '✓' : '✗'}
                </span>
                <span className="font-semibold text-white">FRAGILE</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  fragilePassed ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {fragilePassed ? 'PASS' : 'FAIL'}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {fragileFailed} failures
              </div>
            </div>
          )}
        </div>

        {/* Election Info */}
        <div className="p-4 bg-gray-700/30 rounded-lg mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">Election Duration</div>
              <div className="text-xl font-mono text-white">
                {results.electionDuration.toFixed(1)}s
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Old Primary</div>
              <div className="text-sm font-mono text-gray-300 truncate">
                {results.oldPrimary?.split('.')[0] || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">New Primary</div>
              <div className="text-sm font-mono text-gray-300 truncate">
                {results.newPrimary?.split('.')[0] || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Explanation */}
        {fragileMetrics && !fragilePassed && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <h4 className="font-semibold text-red-400 mb-2">
              Why FRAGILE Failed:
            </h4>
            <p className="text-sm text-gray-300">
              You explicitly set{' '}
              <code className="bg-gray-900 px-1 rounded">
                serverSelectionTimeoutMS=2000
              </code>{' '}
              (2 seconds). During the election, each operation attempt timed out
              before a new primary was ready.
            </p>
            <p className="text-sm text-gray-300 mt-2">
              Even with retries, each attempt only waited 2 seconds — not long enough.
            </p>
          </div>
        )}

        {resilientMetrics && resilientPassed && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg mt-4">
            <h4 className="font-semibold text-green-400 mb-2">
              Why RESILIENT Succeeded:
            </h4>
            <p className="text-sm text-gray-300">
              The default{' '}
              <code className="bg-gray-900 px-1 rounded">
                serverSelectionTimeoutMS=30000
              </code>{' '}
              (30 seconds) {'>'} {results.electionDuration.toFixed(1)} seconds
              (election duration).
            </p>
            <p className="text-sm text-gray-300 mt-2">
              The driver waited long enough for the new primary to be elected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
