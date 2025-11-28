import React from 'react';

interface ConnectionStatusProps {
  connected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connected }) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-green-500 pulse-green' : 'bg-red-500 pulse-red'
        }`}
      />
      <span className={`text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
};
