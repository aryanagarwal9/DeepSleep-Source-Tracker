import { useEffect, useRef, useCallback } from 'react';
import { createOriginalSourceNodes } from '../utils/dataTransformer';

export function useCytoscapeGraph(setSelectedNode, data) {
  const cyRef = useRef(null);

  const highlightPath = (node) => {
    const cy = cyRef.current;
    if (!cy) return;

    // Clear previous highlights and remove any existing original source nodes
    cy.elements().removeClass('highlighted dimmed citation-highlighted');
    cy.nodes('[type="original_source"]').remove();
    cy.edges('[type="source_edge"]').remove();

    const nodeData = node.data();
    const pathElements = cy.collection();
    pathElements.merge(node);

    // If this is a master claim, highlight the path through agent hierarchy
    if (nodeData.type === 'master_claim') {
      const upstreamClaimIds = nodeData.upstream_claim_ids || [];

      // 1. Highlight edge from master_claims_agent to this master claim
      const masterAgentNode = cy.getElementById('master_claims_agent');
      const edgeToMasterClaim = cy.getElementById(`edge_${nodeData.id}_master`);
      if (masterAgentNode.length > 0) {
        pathElements.merge(masterAgentNode);
      }
      if (edgeToMasterClaim.length > 0) {
        pathElements.merge(edgeToMasterClaim);
      }

      // 2. Track which agents have upstream claims
      let hasNewsUpstream = false;
      let hasSocialUpstream = false;

      // 3. Highlight upstream claims and their edges to agents
      // AND create original source nodes for each upstream claim
      upstreamClaimIds.forEach(upstreamId => {
        const upstreamNode = cy.getElementById(upstreamId);
        if (upstreamNode.length > 0) {
          pathElements.merge(upstreamNode);

          // Check which agent this upstream claim belongs to
          const upstreamData = upstreamNode.data();
          const sourceAgent = upstreamData.source_agent;

          // Create original source nodes for this upstream claim
          if (upstreamData.evidence_ids && upstreamData.evidence_ids.length > 0) {
            // Find the full claim data to get the weight information
            const fullClaim = data?.all_upstream_claims?.find(c => c.claim_id === upstreamId);

            if (fullClaim && fullClaim.weight) {
              const { nodes: sourceNodes, edges: sourceEdges } = createOriginalSourceNodes(fullClaim, sourceAgent);

              // Add original source nodes and edges to the graph
              sourceNodes.forEach(nodeObj => {
                cy.add(nodeObj);
              });
              sourceEdges.forEach(edgeObj => {
                cy.add(edgeObj);
              });

              // Add original source nodes and edges to pathElements for highlighting
              sourceNodes.forEach(nodeObj => {
                const addedNode = cy.getElementById(nodeObj.data.id);
                if (addedNode.length > 0) {
                  pathElements.merge(addedNode);
                }
              });
              sourceEdges.forEach(edgeObj => {
                const addedEdge = cy.getElementById(edgeObj.data.id);
                if (addedEdge.length > 0) {
                  pathElements.merge(addedEdge);
                }
              });
            }
          }

          // Find edge from agent to this upstream claim based on source_agent
          if (sourceAgent === 'news') {
            const edgeFromNews = cy.getElementById(`edge_${upstreamId}_news`);
            if (edgeFromNews.length > 0) {
              pathElements.merge(edgeFromNews);
            }
            hasNewsUpstream = true;
          } else if (sourceAgent === 'social') {
            const edgeFromSocial = cy.getElementById(`edge_${upstreamId}_social`);
            if (edgeFromSocial.length > 0) {
              pathElements.merge(edgeFromSocial);
            }
            hasSocialUpstream = true;
          }
        }
      });

      // 4. Only highlight agents and edges that have upstream claims
      if (hasNewsUpstream) {
        const newsAgentNode = cy.getElementById('news_agent');
        const newsToMasterEdge = cy.getElementById('news_to_master');
        if (newsAgentNode.length > 0) pathElements.merge(newsAgentNode);
        if (newsToMasterEdge.length > 0) pathElements.merge(newsToMasterEdge);
      }

      if (hasSocialUpstream) {
        const socialAgentNode = cy.getElementById('social_agent');
        const socialToMasterEdge = cy.getElementById('social_to_master');
        if (socialAgentNode.length > 0) pathElements.merge(socialAgentNode);
        if (socialToMasterEdge.length > 0) pathElements.merge(socialToMasterEdge);
      }
    } else if (nodeData.type === 'upstream_claim') {
      // If this is an upstream claim, highlight path to all master claims that use it
      const upstreamClaimId = nodeData.id;
      const sourceAgent = nodeData.source_agent;

      // Create original source nodes if evidence_ids exist
      if (nodeData.evidence_ids && nodeData.evidence_ids.length > 0) {
        // Find the full claim data to get the weight information
        const fullClaim = data?.all_upstream_claims?.find(c => c.claim_id === upstreamClaimId);

        if (fullClaim && fullClaim.weight) {
          const { nodes: sourceNodes, edges: sourceEdges } = createOriginalSourceNodes(fullClaim, sourceAgent);

          // Add original source nodes and edges to the graph
          sourceNodes.forEach(nodeObj => {
            cy.add(nodeObj);
          });
          sourceEdges.forEach(edgeObj => {
            cy.add(edgeObj);
          });

          // Add original source nodes and edges to pathElements for highlighting
          sourceNodes.forEach(nodeObj => {
            const addedNode = cy.getElementById(nodeObj.data.id);
            if (addedNode.length > 0) {
              pathElements.merge(addedNode);
            }
          });
          sourceEdges.forEach(edgeObj => {
            const addedEdge = cy.getElementById(edgeObj.data.id);
            if (addedEdge.length > 0) {
              pathElements.merge(addedEdge);
            }
          });
        }
      }

      // 1. Highlight the source agent
      const sourceAgentId = sourceAgent === 'news' ? 'news_agent' : 'social_agent';
      const sourceAgentNode = cy.getElementById(sourceAgentId);
      if (sourceAgentNode.length > 0) {
        pathElements.merge(sourceAgentNode);
      }

      // 2. Highlight edge from source agent to upstream claim
      const edgeToUpstream = cy.getElementById(`edge_${upstreamClaimId}_to_agent`);
      if (edgeToUpstream.length > 0) {
        pathElements.merge(edgeToUpstream);
      }

      // 3. Find all master claims that reference this upstream claim
      const allNodes = cy.nodes();
      let foundMasterClaims = false;

      allNodes.forEach(n => {
        const nData = n.data();
        if (nData.type === 'master_claim' && nData.upstream_claim_ids) {
          if (nData.upstream_claim_ids.includes(upstreamClaimId)) {
            // This master claim uses the clicked upstream claim
            pathElements.merge(n);
            foundMasterClaims = true;

            // Highlight edge from master claims agent to this master claim
            const edgeToMaster = cy.getElementById(`edge_${nData.id}_to_agent`);
            if (edgeToMaster.length > 0) {
              pathElements.merge(edgeToMaster);
            }
          }
        }
      });

      // 4. If we found master claims, highlight the path through master claims agent
      if (foundMasterClaims) {
        const masterAgentNode = cy.getElementById('master_claims_agent');
        if (masterAgentNode.length > 0) {
          pathElements.merge(masterAgentNode);
        }

        // Highlight edge from source agent to master claims agent
        const agentToMasterEdge = cy.getElementById(sourceAgent + '_to_master');
        if (agentToMasterEdge.length > 0) {
          pathElements.merge(agentToMasterEdge);
        }
      }
    } else {
      // For other nodes, find all upstream nodes and edges (BFS)
      const visited = new Set([node.id()]);
      const queue = [node];

      while (queue.length > 0) {
        const current = queue.shift();
        const outgoers = current.outgoers('edge');

        outgoers.forEach(edge => {
          pathElements.merge(edge);
          const target = edge.target();
          if (!visited.has(target.id())) {
            visited.add(target.id());
            pathElements.merge(target);
            queue.push(target);
          }
        });
      }
    }

    // Highlight path and dim others
    pathElements.addClass('highlighted');
    cy.elements().not(pathElements).addClass('dimmed');

    // Animate pulse effect
    pathElements.animate({
      style: { 'border-width': 6 }
    }, {
      duration: 300,
      complete: () => {
        pathElements.animate({
          style: { 'border-width': 4 }
        }, {
          duration: 300
        });
      }
    });
  };

  const clearHighlight = () => {
    if (cyRef.current) {
      cyRef.current.elements().removeClass('highlighted dimmed citation-highlighted');
      // Remove original source nodes and edges
      cyRef.current.nodes('[type="original_source"]').remove();
      cyRef.current.edges('[type="source_edge"]').remove();
    }
  };

  const handleSearch = (searchTerm) => {
    if (!cyRef.current || !searchTerm) return;

    const cy = cyRef.current;
    const results = cy.nodes().filter(node => {
      const id = node.data('id') || '';
      const text = node.data('text') || '';
      const term = searchTerm.toLowerCase();
      return id.toLowerCase().includes(term) || text.toLowerCase().includes(term);
    });

    if (results.length > 0) {
      cy.animate({
        fit: { eles: results[0], padding: 50 },
        duration: 500
      });
      results[0].select();
      setSelectedNode(results[0].data());
    }
  };

  const applyFilters = (filters) => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    cy.nodes().forEach(node => {
      const data = node.data();
      let show = true;

      if (filters.asset && data.asset !== filters.asset) show = false;
      if (filters.source_agent && data.source_agent !== filters.source_agent) show = false;
      if (data.sentiment !== undefined) {
        if (data.sentiment < filters.sentimentMin || data.sentiment > filters.sentimentMax) {
          show = false;
        }
      }

      if (show) {
        node.style('display', 'element');
      } else {
        node.style('display', 'none');
      }
    });
  };

  const exportGraph = (format) => {
    if (!cyRef.current) return;

    if (format === 'png') {
      const png = cyRef.current.png({ full: true, scale: 2 });
      const link = document.createElement('a');
      link.download = 'graph.png';
      link.href = png;
      link.click();
    } else if (format === 'svg') {
      const svg = cyRef.current.svg({ full: true });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'graph.svg';
      link.href = url;
      link.click();
    }
  };

  const resetView = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  };

  // Callback to set up Cytoscape instance and event handlers
  const setCyRef = useCallback((cy) => {
    if (!cy) return;

    cyRef.current = cy;

    // Node click handler
    const handleNodeTap = (evt) => {
      const node = evt.target;
      setSelectedNode(node.data());
      highlightPath(node);
    };

    // Background click handler
    const handleBackgroundTap = (evt) => {
      if (evt.target === cy) {
        clearHighlight();
        setSelectedNode(null);
      }
    };

    // Remove any existing listeners first to avoid duplicates
    cy.removeAllListeners();

    // Set up event listeners
    cy.on('tap', 'node', handleNodeTap);
    cy.on('tap', handleBackgroundTap);
  }, [setSelectedNode]);

  const highlightClaimPath = (claim, collectionType, selectedAsset) => {
    const cy = cyRef.current;
    if (!cy) return;

    // Clear previous highlights and remove original source nodes
    cy.elements().removeClass('highlighted dimmed citation-highlighted');
    cy.nodes('[type="original_source"]').remove();
    cy.edges('[type="source_edge"]').remove();

    const pathElements = cy.collection();

    // For news or social upstream claims
    if (collectionType === 'news' || collectionType === 'social') {
      const claimNode = cy.getElementById(claim.claim_id);
      const sourceAgentId = collectionType === 'news' ? 'news_agent' : 'social_agent';
      const sourceAgentNode = cy.getElementById(sourceAgentId);

      if (claimNode.length > 0) {
        pathElements.merge(claimNode);

        // Create original source nodes if evidence_ids exist
        if (claim.evidence_ids && claim.evidence_ids.length > 0 && claim.weight) {
          const { nodes: sourceNodes, edges: sourceEdges } = createOriginalSourceNodes(claim, collectionType);

          // Add original source nodes and edges to the graph
          sourceNodes.forEach(nodeObj => {
            cy.add(nodeObj);
          });
          sourceEdges.forEach(edgeObj => {
            cy.add(edgeObj);
          });

          // Add original source nodes and edges to pathElements for highlighting
          sourceNodes.forEach(nodeObj => {
            const addedNode = cy.getElementById(nodeObj.data.id);
            if (addedNode.length > 0) {
              pathElements.merge(addedNode);
            }
          });
          sourceEdges.forEach(edgeObj => {
            const addedEdge = cy.getElementById(edgeObj.data.id);
            if (addedEdge.length > 0) {
              pathElements.merge(addedEdge);
            }
          });
        }

        // Highlight the source agent
        if (sourceAgentNode.length > 0) {
          pathElements.merge(sourceAgentNode);
        }

        // Highlight edge from agent to claim
        const edgeToUpstream = cy.getElementById(`edge_${claim.claim_id}_to_agent`);
        if (edgeToUpstream.length > 0) {
          pathElements.merge(edgeToUpstream);
        }

        // Find and highlight master claims that use this upstream claim
        const allNodes = cy.nodes();
        let foundMasterClaims = false;

        allNodes.forEach(n => {
          const nData = n.data();
          if (nData.type === 'master_claim' && nData.upstream_claim_ids) {
            if (nData.upstream_claim_ids.includes(claim.claim_id)) {
              pathElements.merge(n);
              foundMasterClaims = true;

              const edgeToMaster = cy.getElementById(`edge_${nData.id}_to_agent`);
              if (edgeToMaster.length > 0) {
                pathElements.merge(edgeToMaster);
              }
            }
          }
        });

        // If master claims were found, highlight the master claims agent and connection
        if (foundMasterClaims) {
          const masterAgentNode = cy.getElementById('master_claims_agent');
          if (masterAgentNode.length > 0) {
            pathElements.merge(masterAgentNode);
          }

          const agentToMasterEdge = cy.getElementById(collectionType + '_to_master');
          if (agentToMasterEdge.length > 0) {
            pathElements.merge(agentToMasterEdge);
          }
        }
      }
    }
    // For master claims
    else if (collectionType === 'master') {
      const masterAgentNode = cy.getElementById('master_claims_agent');
      const masterClaimNode = cy.getElementById(claim.final_claim_id);
      const edgeToMaster = cy.getElementById(`edge_${claim.final_claim_id}_to_agent`);

      if (masterAgentNode.length > 0) pathElements.merge(masterAgentNode);
      if (masterClaimNode.length > 0) pathElements.merge(masterClaimNode);
      if (edgeToMaster.length > 0) pathElements.merge(edgeToMaster);

      // Highlight upstream claims and create their original source nodes
      const upstreamClaimIds = claim.upstream_claim_ids || [];
      let hasNewsUpstream = false;
      let hasSocialUpstream = false;

      // Highlight individual upstream claim nodes if they exist
      upstreamClaimIds.forEach(upstreamId => {
        const upstreamNode = cy.getElementById(upstreamId);
        if (upstreamNode.length > 0) {
          pathElements.merge(upstreamNode);

          // Highlight edge from agent to this upstream claim
          const edgeFromAgent = cy.getElementById(`edge_${upstreamId}_to_agent`);
          if (edgeFromAgent.length > 0) pathElements.merge(edgeFromAgent);
        }

        // Determine if this is a news or social claim and create original source nodes
        const claimData = data?.all_upstream_claims?.find(c => c.claim_id === upstreamId);
        if (claimData) {
          const sourceAgent = claimData.source_agent;

          // Create original source nodes for this upstream claim
          if (claimData.evidence_ids && claimData.evidence_ids.length > 0 && claimData.weight) {
            const { nodes: sourceNodes, edges: sourceEdges } = createOriginalSourceNodes(claimData, sourceAgent);

            // Add original source nodes and edges to the graph
            sourceNodes.forEach(nodeObj => {
              cy.add(nodeObj);
            });
            sourceEdges.forEach(edgeObj => {
              cy.add(edgeObj);
            });

            // Add original source nodes and edges to pathElements for highlighting
            sourceNodes.forEach(nodeObj => {
              const addedNode = cy.getElementById(nodeObj.data.id);
              if (addedNode.length > 0) {
                pathElements.merge(addedNode);
              }
            });
            sourceEdges.forEach(edgeObj => {
              const addedEdge = cy.getElementById(edgeObj.data.id);
              if (addedEdge.length > 0) {
                pathElements.merge(addedEdge);
              }
            });
          }

          if (sourceAgent === 'news') {
            hasNewsUpstream = true;
          } else if (sourceAgent === 'social') {
            hasSocialUpstream = true;
          }
        }
      });

      // Highlight news agent if there are news upstream claims
      if (hasNewsUpstream) {
        const newsAgentNode = cy.getElementById('news_agent');
        const newsToMasterEdge = cy.getElementById('news_to_master');

        if (newsAgentNode.length > 0) pathElements.merge(newsAgentNode);
        if (newsToMasterEdge.length > 0) pathElements.merge(newsToMasterEdge);
      }

      // Highlight social agent if there are social upstream claims
      if (hasSocialUpstream) {
        const socialAgentNode = cy.getElementById('social_agent');
        const socialToMasterEdge = cy.getElementById('social_to_master');

        if (socialAgentNode.length > 0) pathElements.merge(socialAgentNode);
        if (socialToMasterEdge.length > 0) pathElements.merge(socialToMasterEdge);
      }
    }

    // Highlight path and dim others
    pathElements.addClass('highlighted');
    cy.elements().not(pathElements).addClass('dimmed');

    // Animate pulse effect
    pathElements.animate({
      style: { 'border-width': 6 }
    }, {
      duration: 300,
      complete: () => {
        pathElements.animate({
          style: { 'border-width': 4 }
        }, {
          duration: 300
        });
      }
    });
  };

  const highlightSingleCitationClaim = (claimId) => {
    const cy = cyRef.current;
    if (!cy || !claimId) return;

    // Clear previous highlights and remove original source nodes
    cy.elements().removeClass('highlighted dimmed citation-highlighted');
    cy.nodes('[type="original_source"]').remove();
    cy.edges('[type="source_edge"]').remove();

    const pathElements = cy.collection();
    const node = cy.getElementById(claimId);

    if (node.length > 0) {
      pathElements.merge(node);
      const nodeData = node.data();

      // Highlight the claim node with special citation style
      if (nodeData.type === 'master_claim') {
        const masterAgentNode = cy.getElementById('master_claims_agent');
        const edgeToMaster = cy.getElementById(`edge_${claimId}_to_agent`);

        if (masterAgentNode.length > 0) pathElements.merge(masterAgentNode);
        if (edgeToMaster.length > 0) pathElements.merge(edgeToMaster);

        // Highlight upstream claims
        const upstreamClaimIds = nodeData.upstream_claim_ids || [];
        let hasNewsUpstream = false;
        let hasSocialUpstream = false;

        upstreamClaimIds.forEach(upstreamId => {
          const upstreamNode = cy.getElementById(upstreamId);
          if (upstreamNode.length > 0) {
            pathElements.merge(upstreamNode);
            const upstreamData = upstreamNode.data();
            const sourceAgent = upstreamData.source_agent;

            const edgeFromAgent = cy.getElementById(`edge_${upstreamId}_to_agent`);
            if (edgeFromAgent.length > 0) pathElements.merge(edgeFromAgent);

            if (sourceAgent === 'news') hasNewsUpstream = true;
            else if (sourceAgent === 'social') hasSocialUpstream = true;
          }
        });

        if (hasNewsUpstream) {
          const newsAgentNode = cy.getElementById('news_agent');
          const newsToMasterEdge = cy.getElementById('news_to_master');
          if (newsAgentNode.length > 0) pathElements.merge(newsAgentNode);
          if (newsToMasterEdge.length > 0) pathElements.merge(newsToMasterEdge);
        }

        if (hasSocialUpstream) {
          const socialAgentNode = cy.getElementById('social_agent');
          const socialToMasterEdge = cy.getElementById('social_to_master');
          if (socialAgentNode.length > 0) pathElements.merge(socialAgentNode);
          if (socialToMasterEdge.length > 0) pathElements.merge(socialToMasterEdge);
        }
      }
      else if (nodeData.type === 'upstream_claim') {
        const sourceAgent = nodeData.source_agent;
        const sourceAgentId = sourceAgent === 'news' ? 'news_agent' : 'social_agent';
        const sourceAgentNode = cy.getElementById(sourceAgentId);

        if (sourceAgentNode.length > 0) pathElements.merge(sourceAgentNode);

        const edgeToUpstream = cy.getElementById(`edge_${claimId}_to_agent`);
        if (edgeToUpstream.length > 0) pathElements.merge(edgeToUpstream);

        // Find master claims that reference this upstream claim
        const allNodes = cy.nodes();
        let foundMasterClaims = false;

        allNodes.forEach(n => {
          const nData = n.data();
          if (nData.type === 'master_claim' && nData.upstream_claim_ids) {
            if (nData.upstream_claim_ids.includes(claimId)) {
              pathElements.merge(n);
              foundMasterClaims = true;

              const edgeToMaster = cy.getElementById(`edge_${nData.id}_to_agent`);
              if (edgeToMaster.length > 0) pathElements.merge(edgeToMaster);
            }
          }
        });

        if (foundMasterClaims) {
          const masterAgentNode = cy.getElementById('master_claims_agent');
          if (masterAgentNode.length > 0) pathElements.merge(masterAgentNode);

          const agentToMasterEdge = cy.getElementById(sourceAgent + '_to_master');
          if (agentToMasterEdge.length > 0) pathElements.merge(agentToMasterEdge);
        }
      }

      // Use citation-highlighted class for special orange/amber color
      node.addClass('citation-highlighted');
      pathElements.not(node).addClass('highlighted');
      cy.elements().not(pathElements).addClass('dimmed');

      // Animate pulse effect on the cited node
      node.animate({
        style: { 'border-width': 8 }
      }, {
        duration: 300,
        complete: () => {
          node.animate({
            style: { 'border-width': 6 }
          }, {
            duration: 300
          });
        }
      });
    }
  };

  const highlightClaimsByIds = (claimIds) => {
    const cy = cyRef.current;
    if (!cy || !claimIds || claimIds.length === 0) return;

    // Clear previous highlights and remove original source nodes
    cy.elements().removeClass('highlighted dimmed citation-highlighted');
    cy.nodes('[type="original_source"]').remove();
    cy.edges('[type="source_edge"]').remove();

    const pathElements = cy.collection();

    // Find all nodes matching the claim IDs
    claimIds.forEach(claimId => {
      const node = cy.getElementById(claimId);
      if (node.length > 0) {
        pathElements.merge(node);

        const nodeData = node.data();

        // If it's a master claim, highlight its upstream path
        if (nodeData.type === 'master_claim') {
          const masterAgentNode = cy.getElementById('master_claims_agent');
          const edgeToMaster = cy.getElementById(`edge_${claimId}_to_agent`);

          if (masterAgentNode.length > 0) pathElements.merge(masterAgentNode);
          if (edgeToMaster.length > 0) pathElements.merge(edgeToMaster);

          // Highlight upstream claims and their agents
          const upstreamClaimIds = nodeData.upstream_claim_ids || [];
          let hasNewsUpstream = false;
          let hasSocialUpstream = false;

          upstreamClaimIds.forEach(upstreamId => {
            const upstreamNode = cy.getElementById(upstreamId);
            if (upstreamNode.length > 0) {
              pathElements.merge(upstreamNode);
              const upstreamData = upstreamNode.data();
              const sourceAgent = upstreamData.source_agent;

              const edgeFromAgent = cy.getElementById(`edge_${upstreamId}_to_agent`);
              if (edgeFromAgent.length > 0) pathElements.merge(edgeFromAgent);

              if (sourceAgent === 'news') hasNewsUpstream = true;
              else if (sourceAgent === 'social') hasSocialUpstream = true;
            }
          });

          // Highlight agent boxes and connections if they have upstream claims
          if (hasNewsUpstream) {
            const newsAgentNode = cy.getElementById('news_agent');
            const newsToMasterEdge = cy.getElementById('news_to_master');
            if (newsAgentNode.length > 0) pathElements.merge(newsAgentNode);
            if (newsToMasterEdge.length > 0) pathElements.merge(newsToMasterEdge);
          }

          if (hasSocialUpstream) {
            const socialAgentNode = cy.getElementById('social_agent');
            const socialToMasterEdge = cy.getElementById('social_to_master');
            if (socialAgentNode.length > 0) pathElements.merge(socialAgentNode);
            if (socialToMasterEdge.length > 0) pathElements.merge(socialToMasterEdge);
          }
        }
        // If it's an upstream claim, highlight path to master claims
        else if (nodeData.type === 'upstream_claim') {
          const sourceAgent = nodeData.source_agent;
          const sourceAgentId = sourceAgent === 'news' ? 'news_agent' : 'social_agent';
          const sourceAgentNode = cy.getElementById(sourceAgentId);

          if (sourceAgentNode.length > 0) pathElements.merge(sourceAgentNode);

          const edgeToUpstream = cy.getElementById(`edge_${claimId}_to_agent`);
          if (edgeToUpstream.length > 0) pathElements.merge(edgeToUpstream);

          // Find master claims that reference this upstream claim
          const allNodes = cy.nodes();
          let foundMasterClaims = false;

          allNodes.forEach(n => {
            const nData = n.data();
            if (nData.type === 'master_claim' && nData.upstream_claim_ids) {
              if (nData.upstream_claim_ids.includes(claimId)) {
                pathElements.merge(n);
                foundMasterClaims = true;

                const edgeToMaster = cy.getElementById(`edge_${nData.id}_to_agent`);
                if (edgeToMaster.length > 0) pathElements.merge(edgeToMaster);
              }
            }
          });

          if (foundMasterClaims) {
            const masterAgentNode = cy.getElementById('master_claims_agent');
            if (masterAgentNode.length > 0) pathElements.merge(masterAgentNode);

            const agentToMasterEdge = cy.getElementById(sourceAgent + '_to_master');
            if (agentToMasterEdge.length > 0) pathElements.merge(agentToMasterEdge);
          }
        }
      }
    });

    // Highlight path and dim others
    pathElements.addClass('highlighted');
    cy.elements().not(pathElements).addClass('dimmed');

    // Animate pulse effect
    pathElements.animate({
      style: { 'border-width': 6 }
    }, {
      duration: 300,
      complete: () => {
        pathElements.animate({
          style: { 'border-width': 4 }
        }, {
          duration: 300
        });
      }
    });
  };

  return {
    cyRef,
    setCyRef,
    highlightPath,
    highlightClaimPath,
    highlightClaimsByIds,
    highlightSingleCitationClaim,
    clearHighlight,
    handleSearch,
    applyFilters,
    exportGraph,
    resetView
  };
}