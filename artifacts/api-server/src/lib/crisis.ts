const CRISIS_PATTERNS = [
  /\bkill (?:myself|my self)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend (?:my|it all|my life)\b/i,
  /\bwant to die\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  /\bharm (?:myself|my self)\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcan'?t go on\b/i,
  /\bno reason to live\b/i,
  /\bhurt(?:ing)? myself\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}
