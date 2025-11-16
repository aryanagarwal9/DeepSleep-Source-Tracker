import { getSentimentColor } from '../utils/styleUtils';

export const getCytoscapeStylesheet = () => [
  // Default node style
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'font-size': '10px',
      'text-valign': 'center',
      'text-halign': 'center',
      'background-color': '#6366f1',
      'width': 50,
      'height': 50,
      'border-width': 2,
      'border-color': '#fff',
      'transition-property': 'background-color, border-color, opacity',
      'transition-duration': '0.3s'
    }
  },
  // Agent nodes (News Agent, Social Agent, Master Claims)
  {
    selector: 'node[type="agent"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#4f46e5',
      'width': 420,
      'height': 240,
      'font-size': '42px',
      'font-weight': 'bold',
      'text-max-width': '390px',
      'border-width': 9,
      'border-color': '#818cf8'
    }
  },
  // Upstream claim nodes (news and social claims)
  {
    selector: 'node[type="upstream_claim"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': (ele) => {
        const source = ele.data('source_agent');
        return source === 'news' ? '#10b981' : '#8b5cf6';
      },
      'width': 140,
      'height': 70,
      'font-size': '10px',
      'text-max-width': '130px',
      'padding': '6px'
    }
  },
  // Master claim nodes
  {
    selector: 'node[type="master_claim"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f59e0b',
      'width': 140,
      'height': 70,
      'font-size': '10px',
      'text-max-width': '130px',
      'border-color': '#fbbf24',
      'padding': '6px'
    }
  },
  // Collection nodes
  {
    selector: 'node[type="collection"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': (ele) => {
        const collectionType = ele.data('collectionType');
        if (collectionType === 'news') return '#059669';
        if (collectionType === 'social') return '#7c3aed';
        if (collectionType === 'master') return '#d97706';
        return '#6366f1';
      },
      'width': 120,
      'height': 70,
      'font-size': '11px',
      'text-max-width': '110px',
      'border-width': 3,
      'border-color': '#fff'
    }
  },
  // Agent flow edges (between main agents)
  {
    selector: 'edge[type="agent_flow"]',
    style: {
      'width': 4,
      'line-color': '#818cf8',
      'target-arrow-color': '#818cf8',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 2
    }
  },
  // Claim edges (from agents to claims)
  {
    selector: 'edge[type="claim_edge"]',
    style: {
      'width': 2,
      'line-color': '#94a3b8',
      'target-arrow-color': '#94a3b8',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.5
    }
  },
  // Upstream edges (from upstream claims to master claims)
  {
    selector: 'edge[type="upstream_edge"]',
    style: {
      'width': 2,
      'line-color': '#f59e0b',
      'target-arrow-color': '#f59e0b',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.5,
      'line-style': 'dashed'
    }
  },
  // Expanded edges (from collection to individual claim)
  {
    selector: 'edge[type="expanded_edge"]',
    style: {
      'width': 2,
      'line-color': '#94a3b8',
      'target-arrow-color': '#94a3b8',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.5
    }
  },
  // Highlighted elements
  {
    selector: '.highlighted',
    style: {
      'background-color': '#fbbf24',
      'line-color': '#fbbf24',
      'target-arrow-color': '#fbbf24',
      'border-color': '#f59e0b',
      'border-width': 4,
      'opacity': 1,
      'z-index': 999
    }
  },
  // Citation highlighted elements (special color for citation clicks)
  {
    selector: '.citation-highlighted',
    style: {
      'background-color': '#fb923c',
      'line-color': '#fb923c',
      'target-arrow-color': '#fb923c',
      'border-color': '#ea580c',
      'border-width': 6,
      'opacity': 1,
      'z-index': 1000,
      'box-shadow': '0 0 20px #fb923c'
    }
  },
  // Dimmed elements
  {
    selector: '.dimmed',
    style: {
      'opacity': 0.15
    }
  },
  // Selected elements
  {
    selector: ':selected',
    style: {
      'border-width': 4,
      'border-color': '#3b82f6'
    }
  }
];