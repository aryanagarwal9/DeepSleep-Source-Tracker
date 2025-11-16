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
  }
};