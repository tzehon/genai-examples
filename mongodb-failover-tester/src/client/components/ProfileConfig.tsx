import React, { useState } from 'react';
import type { ScenarioType, ConnectionSettings } from '../types';

interface ProfileConfigProps {
  scenario: ScenarioType;
  customSettings: ConnectionSettings;
  onCustomSettingsChange: (settings: ConnectionSettings) => void;
  disabled?: boolean;
}

type ProfileTab = 'resilient' | 'fragile';

export const ProfileConfig: React.FC<ProfileConfigProps> = ({
  scenario,
  customSettings,
  onCustomSettingsChange,
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('resilient');

  const showComparison = scenario === 'compare' || scenario === 'resilient' || scenario === 'fragile';
  const showCustom = scenario === 'custom';

  // For single profile scenarios, force the active tab
  const effectiveTab = scenario === 'resilient' ? 'resilient' :
                       scenario === 'fragile' ? 'fragile' :
                       activeTab;

  if (showComparison) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {/* Tab Headers */}
        {scenario === 'compare' && (
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('resilient')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                effectiveTab === 'resilient'
                  ? 'bg-green-500/10 text-green-400 border-b-2 border-green-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <span className="mr-2">✓</span>
              RESILIENT
            </button>
            <button
              onClick={() => setActiveTab('fragile')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                effectiveTab === 'fragile'
                  ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <span className="mr-2">✗</span>
              FRAGILE
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-4">
          {effectiveTab === 'resilient' ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 text-lg">✓</span>
                <h4 className="font-semibold text-white">Driver Defaults (No Config Needed)</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-gray-500 text-xs">serverSelectionTimeoutMS</div>
                  <div className="text-green-400 font-mono">30000ms</div>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-gray-500 text-xs">socketTimeoutMS</div>
                  <div className="text-green-400 font-mono">No timeout</div>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-gray-500 text-xs">retryWrites</div>
                  <div className="text-green-400 font-mono">true</div>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-gray-500 text-xs">retryReads</div>
                  <div className="text-green-400 font-mono">true</div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm">
                <div className="text-green-400 mb-2">// No config needed!</div>
                <div className="text-white">
                  <span className="text-blue-400">const</span> client = <span className="text-blue-400">new</span> <span className="text-yellow-400">MongoClient</span>(uri);
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400 text-lg">✗</span>
                <h4 className="font-semibold text-white">Short Timeouts + No Retries</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <div className="text-gray-500 text-xs">serverSelectionTimeoutMS</div>
                  <div className="text-red-400 font-mono">2000ms</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <div className="text-gray-500 text-xs">socketTimeoutMS</div>
                  <div className="text-red-400 font-mono">2000ms</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <div className="text-gray-500 text-xs">retryWrites</div>
                  <div className="text-red-400 font-mono">false</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <div className="text-gray-500 text-xs">retryReads</div>
                  <div className="text-red-400 font-mono">false</div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm overflow-x-auto">
                <div className="text-red-400 mb-2">// Bad overrides!</div>
                <div className="text-white whitespace-nowrap">
                  <span className="text-blue-400">const</span> client = <span className="text-blue-400">new</span> <span className="text-yellow-400">MongoClient</span>(uri, {'{'}</div>
                <div className="text-red-400 pl-4">serverSelectionTimeoutMS: <span className="text-orange-300">2000</span>,</div>
                <div className="text-red-400 pl-4">socketTimeoutMS: <span className="text-orange-300">2000</span>,</div>
                <div className="text-red-400 pl-4">retryWrites: <span className="text-orange-300">false</span>,</div>
                <div className="text-red-400 pl-4">retryReads: <span className="text-orange-300">false</span>,</div>
                <div className="text-white">{'}'});</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showCustom) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="font-semibold text-white mb-4">Custom Configuration</h4>

        <div className="space-y-4">
          {/* serverSelectionTimeoutMS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">serverSelectionTimeoutMS</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={customSettings.serverSelectionTimeoutMS === null}
                  onChange={(e) =>
                    onCustomSettingsChange({
                      ...customSettings,
                      serverSelectionTimeoutMS: e.target.checked ? null : 30000,
                    })
                  }
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-xs text-gray-500">Use default</span>
              </label>
            </div>
            {customSettings.serverSelectionTimeoutMS !== null && (
              <input
                type="number"
                value={customSettings.serverSelectionTimeoutMS || 30000}
                onChange={(e) =>
                  onCustomSettingsChange({
                    ...customSettings,
                    serverSelectionTimeoutMS: parseInt(e.target.value) || 0,
                  })
                }
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="milliseconds"
              />
            )}
            {customSettings.serverSelectionTimeoutMS !== null &&
              customSettings.serverSelectionTimeoutMS !== undefined &&
              customSettings.serverSelectionTimeoutMS < 30000 && (
                <p className="text-xs text-yellow-400 mt-1">
                  Warning: Less than 30s may cause failures during elections
                </p>
              )}
          </div>

          {/* socketTimeoutMS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">socketTimeoutMS</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={customSettings.socketTimeoutMS === null}
                  onChange={(e) =>
                    onCustomSettingsChange({
                      ...customSettings,
                      socketTimeoutMS: e.target.checked ? null : 30000,
                    })
                  }
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-xs text-gray-500">Use default</span>
              </label>
            </div>
            {customSettings.socketTimeoutMS !== null && (
              <input
                type="number"
                value={customSettings.socketTimeoutMS || 0}
                onChange={(e) =>
                  onCustomSettingsChange({
                    ...customSettings,
                    socketTimeoutMS: parseInt(e.target.value) || 0,
                  })
                }
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="milliseconds (0 = no timeout)"
              />
            )}
          </div>

          {/* retryWrites */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">retryWrites</label>
            <select
              value={
                customSettings.retryWrites === null
                  ? 'default'
                  : customSettings.retryWrites
                  ? 'true'
                  : 'false'
              }
              onChange={(e) =>
                onCustomSettingsChange({
                  ...customSettings,
                  retryWrites:
                    e.target.value === 'default'
                      ? null
                      : e.target.value === 'true',
                })
              }
              disabled={disabled}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="default">Use default (true)</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>

          {/* retryReads */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">retryReads</label>
            <select
              value={
                customSettings.retryReads === null
                  ? 'default'
                  : customSettings.retryReads
                  ? 'true'
                  : 'false'
              }
              onChange={(e) =>
                onCustomSettingsChange({
                  ...customSettings,
                  retryReads:
                    e.target.value === 'default'
                      ? null
                      : e.target.value === 'true',
                })
              }
              disabled={disabled}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="default">Use default (true)</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
