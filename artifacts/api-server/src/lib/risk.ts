/**
 * Safety screening for journal entries and other free text.
 *
 * Produces a risk level 0-4 and a set of plain-language flags. The number is an
 * internal signal only; it is never shown to the person as a score. Higher
 * levels let the app respond more actively (surface crisis support, offer to
 * share with the care team) while keeping the tone calm and non-alarming.
 *
 *   0  no concern detected
 *   1  heavy distress, overwhelm
 *   2  hopelessness or self-destructive coping
 *   3  passive ideation, thoughts of not wanting to be here, self-harm
 *   4  active suicidal intent, a plan, means, or final/goodbye language
 */

export type RiskScore = {
  level: 0 | 1 | 2 | 3 | 4;
  flags: string[];
};

type Rule = {
  level: 1 | 2 | 3 | 4;
  flag: string;
  patterns: RegExp[];
};

const RULES: Rule[] = [
  {
    level: 4,
    flag: "active-suicidal-intent",
    patterns: [
      /\bkill (?:myself|my self)\b/i,
      /\bend (?:my life|it all|myself)\b/i,
      /\btake my (?:own )?life\b/i,
      /\bi(?:'m| am)? (?:going to|gonna) (?:die|kill myself|end it)\b/i,
      /\bi have a plan\b/i,
      /\bwhen i(?:'m| am)? gone\b/i,
      /\bthis is goodbye\b/i,
      /\bsaying goodbye\b/i,
    ],
  },
  {
    level: 3,
    flag: "suicidal-ideation",
    patterns: [
      /\bsuicid(?:e|al)\b/i,
      /\bwant to die\b/i,
      /\bwish i (?:were|was) dead\b/i,
      /\bbetter off (?:dead|without me)\b/i,
      /\bno reason to (?:live|go on)\b/i,
      /\bdon'?t want to (?:be here|wake up|live)\b/i,
    ],
  },
  {
    level: 3,
    flag: "self-harm",
    patterns: [
      /\bself[-\s]?harm\b/i,
      /\bharm (?:myself|my self)\b/i,
      /\bhurt(?:ing)? myself\b/i,
      /\bcut(?:ting)? myself\b/i,
    ],
  },
  {
    level: 2,
    flag: "hopelessness",
    patterns: [
      /\bcan'?t go on\b/i,
      /\bcan'?t do this anymore\b/i,
      /\bno point\b/i,
      /\bnothing matters\b/i,
      /\bhopeless\b/i,
      /\bgive up\b/i,
    ],
  },
  {
    level: 2,
    flag: "self-destructive-coping",
    patterns: [
      /\bdrink(?:ing)? (?:myself|to numb|to forget|too much)\b/i,
      /\bnot (?:eating|sleeping) (?:at all|for days)\b/i,
      /\bstopped eating\b/i,
      /\btaking (?:too many|more) pills\b/i,
      /\bnumb(?:ing)? (?:the pain|myself)\b/i,
    ],
  },
  {
    level: 1,
    flag: "acute-distress",
    patterns: [
      /\boverwhelm(?:ed|ing)\b/i,
      /\bcan'?t (?:cope|breathe|stop crying)\b/i,
      /\bfalling apart\b/i,
      /\bunbearable\b/i,
      /\bpanic(?:king)?\b/i,
    ],
  },
];

export function scoreRisk(text: string): RiskScore {
  const flags: string[] = [];
  let level: RiskScore["level"] = 0;

  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(text))) {
      flags.push(rule.flag);
      if (rule.level > level) level = rule.level;
    }
  }

  return { level, flags };
}
