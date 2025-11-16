export function transformToElements(data, selectedAsset = null, selectedMasterClaim = null) {
  const nodes = [];
  const edges = [];

  // Create the three main agent nodes - spread them out more
  nodes.push({
    data: {
      id: 'news_agent',
      label: 'News Agent',
      type: 'agent',
      agentType: 'news'
    },
    position: { x: -800, y: 0 }
  });

  nodes.push({
    data: {
      id: 'social_agent',
      label: 'Social Agent',
      type: 'agent',
      agentType: 'social'
    },
    position: { x: 800, y: 0 }
  });

  nodes.push({
    data: {
      id: 'master_claims_agent',
      label: 'Aggregator',
      type: 'agent',
      agentType: 'master'
    },
    position: { x: 0, y: 600 }
  });

  // Add edges showing data flow to master claims
  edges.push({
    data: {
      id: 'news_to_master',
      source: 'news_agent',
      target: 'master_claims_agent',
      type: 'agent_flow'
    }
  });

  edges.push({
    data: {
      id: 'social_to_master',
      source: 'social_agent',
      target: 'master_claims_agent',
      type: 'agent_flow'
    }
  });

  // If an asset is selected, show all upstream claims for that asset
  if (selectedAsset && data.all_upstream_claims) {
    // Get all upstream claims for the selected asset
    const newsUpstreamClaims = data.all_upstream_claims.filter(
      claim => claim.asset === selectedAsset && claim.source_agent === 'news'
    );
    const socialUpstreamClaims = data.all_upstream_claims.filter(
      claim => claim.asset === selectedAsset && claim.source_agent === 'social'
    );

    if (newsUpstreamClaims.length > 0 || socialUpstreamClaims.length > 0) {

      // Add news upstream claims with position index
      console.log('Creating news upstream claims:', newsUpstreamClaims.length);
      newsUpstreamClaims.forEach((claim, index) => {
        // Grid layout: arrange nodes in a grid below the agent
        const nodesPerRow = 4; // 4 nodes per row
        const horizontalSpacing = 180; // space between nodes horizontally
        const verticalSpacing = 100; // space between nodes vertically

        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;

        // Center the grid around the agent
        const totalCols = Math.min(nodesPerRow, newsUpstreamClaims.length);
        const gridWidth = (totalCols - 1) * horizontalSpacing;
        const startX = -800 - (gridWidth / 2); // news agent is at -800

        const position = {
          x: startX + (col * horizontalSpacing),
          y: 200 + (row * verticalSpacing) // Start below the agent
        };

        const nodeData = {
          id: claim.claim_id,
          label: claim.text.substring(0, 40) + (claim.text.length > 40 ? '...' : ''),
          text: claim.text,
          asset: claim.asset,
          source_agent: claim.source_agent,
          evidence_ids: claim.evidence_ids || [],
          type: 'upstream_claim',
          layoutIndex: index,
          layoutTotal: newsUpstreamClaims.length
        };
        console.log('Creating news upstream node:', nodeData.id, 'index:', index, 'total:', newsUpstreamClaims.length, 'position:', position);
        nodes.push({ data: nodeData, position: position });

        edges.push({
          data: {
            id: `edge_${claim.claim_id}_to_agent`,
            source: 'news_agent',
            target: claim.claim_id,
            type: 'claim_edge'
          }
        });
      });

      // Add social upstream claims with position index
      console.log('Creating social upstream claims:', socialUpstreamClaims.length);
      socialUpstreamClaims.forEach((claim, index) => {
        // Grid layout: arrange nodes in a grid below the agent
        const nodesPerRow = 4; // 4 nodes per row
        const horizontalSpacing = 180; // space between nodes horizontally
        const verticalSpacing = 100; // space between nodes vertically

        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;

        // Center the grid around the agent
        const totalCols = Math.min(nodesPerRow, socialUpstreamClaims.length);
        const gridWidth = (totalCols - 1) * horizontalSpacing;
        const startX = 800 - (gridWidth / 2); // social agent is at 800

        const position = {
          x: startX + (col * horizontalSpacing),
          y: 200 + (row * verticalSpacing) // Start below the agent
        };

        const nodeData = {
          id: claim.claim_id,
          label: claim.text.substring(0, 40) + (claim.text.length > 40 ? '...' : ''),
          text: claim.text,
          asset: claim.asset,
          source_agent: claim.source_agent,
          evidence_ids: claim.evidence_ids || [],
          type: 'upstream_claim',
          layoutIndex: index,
          layoutTotal: socialUpstreamClaims.length
        };
        console.log('Creating social upstream node:', nodeData.id, 'index:', index, 'total:', socialUpstreamClaims.length, 'position:', position);
        nodes.push({ data: nodeData, position: position });

        edges.push({
          data: {
            id: `edge_${claim.claim_id}_to_agent`,
            source: 'social_agent',
            target: claim.claim_id,
            type: 'claim_edge'
          }
        });
      });
    }
  }

  // If an asset is selected, show all master claims for that asset
  if (selectedAsset && data.master_claims_by_asset && data.master_claims_by_asset[selectedAsset]) {
    const masterClaims = data.master_claims_by_asset[selectedAsset];

    console.log('Creating master claims:', masterClaims.length);
    masterClaims.forEach((claim, index) => {
      // Grid layout: arrange nodes in a grid below the master claims agent
      const nodesPerRow = 4; // 4 nodes per row
      const horizontalSpacing = 180; // space between nodes horizontally
      const verticalSpacing = 100; // space between nodes vertically

      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;

      // Center the grid around the agent
      const totalCols = Math.min(nodesPerRow, masterClaims.length);
      const gridWidth = (totalCols - 1) * horizontalSpacing;
      const startX = 0 - (gridWidth / 2); // master claims agent is at x=0

      const position = {
        x: startX + (col * horizontalSpacing),
        y: 800 + (row * verticalSpacing) // Start below the master claims agent
      };

      nodes.push({
        data: {
          id: claim.final_claim_id,
          label: claim.text.substring(0, 40) + (claim.text.length > 40 ? '...' : ''),
          text: claim.text,
          asset: claim.asset,
          upstream_claim_ids: claim.upstream_claim_ids || [],
          type: 'master_claim',
          layoutIndex: index,
          layoutTotal: masterClaims.length
        },
        position: position
      });

      // Add edge from master agent to master claim
      edges.push({
        data: {
          id: `edge_${claim.final_claim_id}_to_agent`,
          source: 'master_claims_agent',
          target: claim.final_claim_id,
          type: 'claim_edge'
        }
      });
    });
  }

  return [...nodes, ...edges];
}