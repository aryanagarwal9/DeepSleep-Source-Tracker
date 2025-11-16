import React from 'react';
import { TrendingUp } from 'lucide-react';

const ASSETS = [
  { symbol: 'NVDA', name: 'NVIDIA', color: 'bg-green-500' },
  { symbol: 'TSLA', name: 'Tesla', color: 'bg-red-500' },
  { symbol: 'GOLD', name: 'Gold', color: 'bg-yellow-500' }
];

export default function AssetSelector({ selectedAsset, onAssetSelect }) {
  return (
    <div className="bg-gray-800 border-t border-gray-700 p-4 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={20} />
        <h2 className="text-lg font-bold">Assets:</h2>
      </div>

      <div className="flex gap-3 flex-1">
        {ASSETS.map(asset => (
          <button
            key={asset.symbol}
            onClick={() => onAssetSelect(asset.symbol === selectedAsset ? null : asset.symbol)}
            className={`
              px-4 py-2 rounded-lg border-2 transition-all
              ${selectedAsset === asset.symbol
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${asset.color}`} />
              <div className="flex items-baseline gap-2">
                <div className="font-bold">{asset.symbol}</div>
                <div className="text-xs text-gray-400">{asset.name}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedAsset && (
        <button
          onClick={() => onAssetSelect(null)}
          className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm whitespace-nowrap"
        >
          Clear Selection
        </button>
      )}
    </div>
  );
}
