import React from 'react';
import type { ScenarioType } from '../types';

interface ScenarioSelectorProps {
  scenario: ScenarioType;
  onChange: (scenario: ScenarioType) => void;
  disabled?: boolean;
}

const scenarios: { value: ScenarioType; label: string; description: string; recommended?: boolean }[] = [
  {
    value: 'compare',
    label: 'Compare Both',
    description: 'See the difference side-by-side',
    recommended: true,
  },
  {
    value: 'resilient',
    label: 'Resilient Only',
    description: '30s timeout (driver default)',
  },
  {
    value: 'fragile',
    label: 'Fragile Only',
    description: '2s timeout + no retries',
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Configure your own settings',
  },
];

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  scenario,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-3">Test Scenario</h3>

      <div className="grid grid-cols-2 gap-2">
        {scenarios.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            disabled={disabled}
            className={`relative p-3 rounded-lg border-2 text-left transition-all ${
              scenario === s.value
                ? 'border-green-500 bg-green-500/10'
                : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {s.recommended && (
              <span className="absolute -top-2 right-2 text-xs px-1.5 py-0.5 bg-green-600 text-white rounded">
                Recommended
              </span>
            )}
            <span className="font-medium text-white">{s.label}</span>
            <p className="text-xs text-gray-400 mt-1">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
