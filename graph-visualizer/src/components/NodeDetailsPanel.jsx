import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getSentimentColor } from '../utils/styleUtils';

export default function NodeDetailsPanel({ selectedNode, onClose, onClaimClick, masterClaims, newsClaims, socialClaims }) {
  const [selectedClaim, setSelectedClaim] = useState(null);

  console.log('NodeDetailsPanel - selectedNode:', selectedNode);
  console.log('NodeDetailsPanel - masterClaims:', masterClaims);

  if (!selectedNode) return null;

  // If this is the news agent, show the list of news claims
  if (selectedNode.id === 'news_agent' && newsClaims && newsClaims.length > 0) {
    return (
      <div className="w-96 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col h-full max-h-full overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">News Claims</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="text-sm text-gray-400">
            {newsClaims.length} news claims for this asset
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="space-y-2">
            {newsClaims.map((claim, index) => (
              <div
                key={claim.claim_id || index}
                onClick={() => {
                  setSelectedClaim(claim);
                  if (onClaimClick) {
                    onClaimClick(claim, 'news');
                  }
                }}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${selectedClaim === claim
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                  }
                `}
              >
                <div className="text-sm font-medium mb-1">
                  {claim.text || 'No text available'}
                </div>
                {claim.evidence_ids && claim.evidence_ids.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Evidence: {claim.evidence_ids.length} items
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If this is the social agent, show the list of social claims
  if (selectedNode.id === 'social_agent' && socialClaims && socialClaims.length > 0) {
    return (
      <div className="w-96 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col h-full max-h-full overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Social Claims</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="text-sm text-gray-400">
            {socialClaims.length} social claims for this asset
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="space-y-2">
            {socialClaims.map((claim, index) => (
              <div
                key={claim.claim_id || index}
                onClick={() => {
                  setSelectedClaim(claim);
                  if (onClaimClick) {
                    onClaimClick(claim, 'social');
                  }
                }}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${selectedClaim === claim
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                  }
                `}
              >
                <div className="text-sm font-medium mb-1">
                  {claim.text || 'No text available'}
                </div>
                {claim.evidence_ids && claim.evidence_ids.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Evidence: {claim.evidence_ids.length} items
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If this is the master claims agent, show the list of master claims
  if (selectedNode.id === 'master_claims_agent') {
    if (!masterClaims || masterClaims.length === 0) {
      return (
        <div className="w-96 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col h-full max-h-full overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Aggregator</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-400">
              <p className="mb-2">No aggregated claims to display</p>
              <p className="text-sm">Select an asset from the bottom bar to view aggregated claims</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-96 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col h-full max-h-full overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Aggregator</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="text-sm text-gray-400">
            Click on a claim to see its upstream sources
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="space-y-2">
            {masterClaims.map((claim, index) => (
              <div
                key={claim.final_claim_id || index}
                onClick={() => {
                  setSelectedClaim(claim);
                  if (onClaimClick) {
                    onClaimClick(claim, 'master');
                  }
                }}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${selectedClaim === claim
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                  }
                `}
              >
                <div className="text-sm font-medium mb-1">
                  {claim.text || 'No text available'}
                </div>
                {claim.upstream_claim_ids && claim.upstream_claim_ids.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Connected to: {claim.upstream_claim_ids.length} upstream claims
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If this is a collection node, show the list of claims
  if (selectedNode.type === 'collection' && selectedNode.claims) {
    return (
      <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">{selectedNode.label}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="text-sm text-gray-400">
            Click on a claim to highlight its path
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {selectedNode.claims.map((claim, index) => (
              <div
                key={claim.claim_id || claim.final_claim_id || index}
                onClick={() => {
                  setSelectedClaim(claim);
                  if (onClaimClick) {
                    onClaimClick(claim, selectedNode.collectionType);
                  }
                }}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${selectedClaim === claim
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                  }
                `}
              >
                <div className="text-sm font-medium mb-1">
                  {claim.text || 'No text available'}
                </div>
                {claim.evidence_ids && claim.evidence_ids.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Evidence: {claim.evidence_ids.length} items
                  </div>
                )}
                {claim.upstream_claim_ids && claim.upstream_claim_ids.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Connected to: {claim.upstream_claim_ids.length} upstream claims
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Regular node details display
  return (
    <div className="w-96 bg-gray-800 border-l border-gray-700 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Node Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">ID</div>
            <div className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">{selectedNode.id}</div>
          </div>

          {selectedNode.asset && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Asset</div>
              <div className="text-sm">{selectedNode.asset}</div>
            </div>
          )}

          {selectedNode.source_agent && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Source</div>
              <div className="text-sm capitalize">{selectedNode.source_agent}</div>
            </div>
          )}

          {selectedNode.sentiment !== undefined && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Sentiment</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: getSentimentColor(selectedNode.sentiment) }}
                ></div>
                <span className="text-sm">{selectedNode.sentiment.toFixed(2)}</span>
              </div>
            </div>
          )}

          {selectedNode.text && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Text</div>
              <div className="text-sm">{selectedNode.text}</div>
            </div>
          )}

          {selectedNode.evidence_ids && selectedNode.evidence_ids.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Evidence ({selectedNode.evidence_ids.length})</div>
              <div className="flex flex-wrap gap-1">
                {selectedNode.evidence_ids.map(id => (
                  <span key={id} className="text-xs bg-gray-700 px-2 py-1 rounded">{id}</span>
                ))}
              </div>
            </div>
          )}

          {selectedNode.upstream_claim_ids && selectedNode.upstream_claim_ids.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Connected Claims</div>
              <div className="space-y-1">
                {selectedNode.upstream_claim_ids.map(id => (
                  <div key={id} className="text-xs bg-gray-700 px-2 py-1 rounded">{id}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}