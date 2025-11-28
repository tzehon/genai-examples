import React from 'react';

export const WhatToChange: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gray-700/50">
        <h3 className="text-lg font-semibold text-white">The Takeaway</h3>
      </div>

      <div className="p-4 space-y-6">
        {/* Do This */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-400 text-xl">✓</span>
            <h4 className="font-semibold text-white">DO THIS: Use driver defaults</h4>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <div className="text-gray-400">
              {'// The defaults are already configured for resilience'}
            </div>
            <div className="text-white mt-2">
              const client = <span className="text-blue-400">new</span>{' '}
              <span className="text-yellow-400">MongoClient</span>(uri);
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-400">
            <p>The driver defaults are already optimized for failover:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <code className="text-green-400">retryWrites: true</code> (automatic since 4.2)
              </li>
              <li>
                <code className="text-green-400">retryReads: true</code> (automatic since 6.0)
              </li>
              <li>
                <code className="text-green-400">serverSelectionTimeoutMS: 30000</code> (30 seconds)
              </li>
            </ul>
          </div>
        </div>

        {/* Don't Do This */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-400 text-xl">✗</span>
            <h4 className="font-semibold text-white">
              DON'T DO THIS: Override with short timeouts
            </h4>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <div className="text-gray-400">{'// Bad: Explicit short timeouts'}</div>
            <div className="text-white mt-2">
              const client = <span className="text-blue-400">new</span>{' '}
              <span className="text-yellow-400">MongoClient</span>(uri, {'{'}
            </div>
            <div className="text-red-400 pl-4">
              serverSelectionTimeoutMS: 2000, <span className="text-gray-500">// Too short!</span>
            </div>
            <div className="text-red-400 pl-4">
              socketTimeoutMS: 2000, <span className="text-gray-500">// Too short!</span>
            </div>
            <div className="text-white">{'}'});</div>
          </div>
        </div>

        {/* Why */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <h4 className="font-semibold text-yellow-400 mb-2">WHY?</h4>
          <p className="text-sm text-gray-300">
            Elections take <strong>10-30 seconds</strong>. If your timeout is shorter
            than the election duration, operations will fail because the driver
            gives up waiting before a new primary is ready.
          </p>
        </div>

        {/* If You Must */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-xl">⚠</span>
            <h4 className="font-semibold text-white">If you MUST set timeouts:</h4>
          </div>
          <div className="text-sm text-gray-400">
            <p>
              Ensure{' '}
              <code className="bg-gray-900 px-1 rounded text-white">
                serverSelectionTimeoutMS &gt;= 30000
              </code>
            </p>
            <p className="mt-2">
              This gives the driver enough time to wait for a new primary during
              elections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
