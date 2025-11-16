export function getSentimentColor(sentiment) {
  if (sentiment < 0) {
    const intensity = Math.abs(sentiment);
    return `rgb(${Math.round(239 * (0.3 + intensity * 0.7))}, ${Math.round(68 * (1 - intensity * 0.5))}, ${Math.round(68 * (1 - intensity * 0.5))})`;
  } else if (sentiment > 0) {
    return `rgb(${Math.round(34 * (1 - sentiment * 0.5))}, ${Math.round(197 * (0.5 + sentiment * 0.5))}, ${Math.round(94 * (0.5 + sentiment * 0.5))})`;
  }
  return '#9ca3af';
}