import React from 'react';

export default function FiltersPanel({ filters, setFilters }) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Asset</label>
          <input
            type="text"
            value={filters.asset}
            onChange={(e) => setFilters({ ...filters, asset: e.target.value })}
            placeholder="e.g., NVDA"
            className="w-full bg-gray-700 px-3 py-2 rounded outline-none"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Source Agent</label>
          <select
            value={filters.source_agent}
            onChange={(e) => setFilters({ ...filters, source_agent: e.target.value })}
            className="w-full bg-gray-700 px-3 py-2 rounded outline-none"
          >
            <option value="">All</option>
            <option value="news">News</option>
            <option value="social">Social</option>
            <option value="alt">Alt</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Sentiment Min: {filters.sentimentMin}</label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.1"
            value={filters.sentimentMin}
            onChange={(e) => setFilters({ ...filters, sentimentMin: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Sentiment Max: {filters.sentimentMax}</label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.1"
            value={filters.sentimentMax}
            onChange={(e) => setFilters({ ...filters, sentimentMax: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}