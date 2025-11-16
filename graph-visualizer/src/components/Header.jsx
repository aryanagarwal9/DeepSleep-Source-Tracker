import React from 'react';
import { Search, Filter, Download, Maximize2 } from 'lucide-react';

export default function Header({
  searchTerm,
  setSearchTerm,
  handleSearch,
  showFilters,
  setShowFilters,
  exportGraph,
  resetView
}) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
      <h1 className="text-xl font-bold">Source Trace Visualiser</h1>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-lg">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-transparent outline-none w-48"
          />
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          <Filter size={16} />
        </button>

        {/* Export */}
        <div className="relative group">
          <button className="bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors">
            <Download size={16} />
          </button>
          <div className="absolute right-0 mt-2 bg-gray-700 rounded-lg shadow-lg hidden group-hover:block z-50">
            <button onClick={() => exportGraph('png')} className="block w-full px-4 py-2 text-left hover:bg-gray-600">PNG</button>
            <button onClick={() => exportGraph('svg')} className="block w-full px-4 py-2 text-left hover:bg-gray-600">SVG</button>
          </div>
        </div>

        <button
          onClick={resetView}
          className="bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}