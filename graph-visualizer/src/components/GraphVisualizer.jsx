import React, { useState, useEffect, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

import Header from './Header';
import AssetSelector from './AssetSelector';
import FiltersPanel from './FiltersPanel';
import GraphLegend from './GraphLegend';
import NodeDetailsPanel from './NodeDetailsPanel';

import { transformToElements } from '../utils/dataTransformer';
import { getCytoscapeStylesheet } from '../constants/cytoscapeStyles';
import { LAYOUT_OPTIONS } from '../constants/layoutOptions';
import { SAMPLE_DATA } from '../constants/sampleData';
import { useCytoscapeGraph } from '../hooks/useCytoscapeGraph';

// Register layout
Cytoscape.use(coseBilkent);

export default function GraphVisualizer() {
  const [elements, setElements] = useState([]);
  const [layout, setLayout] = useState('custom');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    asset: '',
    source_agent: '',
    sentimentMin: -1,
    sentimentMax: 1
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedMasterClaim, setSelectedMasterClaim] = useState(null);

  const {
    cyRef,
    handleSearch,
    applyFilters,
    exportGraph,
    resetView,
    highlightClaimPath
  } = useCytoscapeGraph(setSelectedNode, SAMPLE_DATA);

  const handleClaimClick = (claim, collectionType) => {
    if (collectionType === 'master') {
      // Toggle selection for master claims
      if (selectedMasterClaim === claim) {
        setSelectedMasterClaim(null);
      } else {
        setSelectedMasterClaim(claim);
        // Delay highlighting until after graph updates with new nodes
        setTimeout(() => {
          highlightClaimPath(claim, collectionType, selectedAsset);
        }, 100);
        return;
      }
    }
    highlightClaimPath(claim, collectionType, selectedAsset);
  };

  const stylesheet = useMemo(() => getCytoscapeStylesheet(), []);

  // Update elements when asset selection or master claim selection changes
  useEffect(() => {
    const els = transformToElements(SAMPLE_DATA, selectedAsset, selectedMasterClaim);
    setElements(els);
  }, [selectedAsset, selectedMasterClaim]);

  useEffect(() => {
    applyFilters(filters);
  }, [filters]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
      <Header
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        handleSearch={() => handleSearch(searchTerm)}
        layout={layout}
        setLayout={setLayout}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        exportGraph={exportGraph}
        resetView={resetView}
      />

      {showFilters && (
        <FiltersPanel filters={filters} setFilters={setFilters} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative">
            <CytoscapeComponent
              key={`${selectedAsset}-${selectedMasterClaim?.final_claim_id || 'none'}`}
              elements={elements}
              style={{ width: '100%', height: '100%' }}
              stylesheet={stylesheet}
              layout={LAYOUT_OPTIONS[layout]}
              cy={(cy) => { cyRef.current = cy; }}
              wheelSensitivity={0.2}
            />

            <GraphLegend />
          </div>

          <NodeDetailsPanel
            selectedNode={selectedNode}
            onClose={() => setSelectedNode(null)}
            onClaimClick={handleClaimClick}
            masterClaims={selectedAsset ? SAMPLE_DATA.master_claims_by_asset[selectedAsset] : []}
            newsClaims={selectedAsset ? SAMPLE_DATA.all_upstream_claims.filter(
              claim => claim.asset === selectedAsset && claim.source_agent === 'news'
            ) : []}
            socialClaims={selectedAsset ? SAMPLE_DATA.all_upstream_claims.filter(
              claim => claim.asset === selectedAsset && claim.source_agent === 'social'
            ) : []}
          />
        </div>

        <AssetSelector
          selectedAsset={selectedAsset}
          onAssetSelect={setSelectedAsset}
        />
      </div>
    </div>
  );
}