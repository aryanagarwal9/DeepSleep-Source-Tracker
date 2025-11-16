import React from 'react';
import { getSentimentColor } from '../utils/styleUtils';

export default function GraphLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg shadow-lg">
      <div className="text-sm font-semibold mb-2">Sentiment Scale</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: getSentimentColor(-0.8) }}></div>
        <span className="text-xs">Very Negative</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: getSentimentColor(0) }}></div>
        <span className="text-xs">Neutral</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: getSentimentColor(0.8) }}></div>
        <span className="text-xs">Very Positive</span>
      </div>
      <div className="text-sm font-semibold mb-2">Node Types</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-4 h-4 rounded-full bg-gray-400"></div>
        <span className="text-xs">Claim</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-indigo-500 transform rotate-45"></div>
        <span className="text-xs">Sentence</span>
      </div>
    </div>
  );
}