export const LAYOUT_OPTIONS = {
  'custom': {
    name: 'preset',
    // Positions are now set directly on nodes in dataTransformer.js
    // This positions function serves as a fallback
    positions: function(node) {
      const data = node.data();

      // Agent boxes fallback positions
      if (data.id === 'news_agent') return { x: -800, y: 0 };
      if (data.id === 'social_agent') return { x: 800, y: 0 };
      if (data.id === 'master_claims_agent') return { x: 0, y: 600 };
      if (data.type === 'master_claim') return { x: 0, y: 800 };

      // Default fallback
      return { x: 0, y: 0 };
    },
    animate: false,
    animationDuration: 0,
    fit: true,
    padding: 100
  },
  'cose-bilkent': {
    name: 'cose-bilkent',
    quality: 'default',
    nodeDimensionsIncludeLabels: true,
    randomize: false,
    idealEdgeLength: 120,
    edgeElasticity: 0.45,
    nestingFactor: 0.1,
    gravity: 0.25,
    numIter: 2500,
    tile: true,
    animate: true,
    animationDuration: 1000
  },
  'circle': {
    name: 'circle',
    animate: true,
    animationDuration: 1000
  },
  'grid': {
    name: 'grid',
    animate: true,
    animationDuration: 1000
  }
};