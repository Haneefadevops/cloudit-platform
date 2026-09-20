/**
 * Deterministic alert templates (Phase F).
 *
 * Fixed, bounded, deterministic text only. Templates receive closed values
 * (environmentKey, subjectKey, category, evidence count) and NEVER include
 * verdict.summary or evidence key text. Every rendered message is post-checked
 * with `detectCanaryLeak` from the contracts package; on any leak the text is
 * replaced by the fixed safe template. No network, no clocks, no I/O.
 */

import { detectCanaryLeak } from '@cloudit/operations-agent-contracts';

export const ALERT_TEXT_MAX_CHARS = 400;

function boundedSafeTemplate(environmentKey: string, subjectKey: string): string {
  const text = `CloudIT alert [environment=${environmentKey} subject=${subjectKey}]. Details withheld by security policy.`;
  return text.length <= ALERT_TEXT_MAX_CHARS ? text : text.slice(0, ALERT_TEXT_MAX_CHARS);
}

function guard(text: string, environmentKey: string, subjectKey: string): string {
  const bounded = text.length <= ALERT_TEXT_MAX_CHARS ? text : boundedSafeTemplate(environmentKey, subjectKey);
  try {
    if (detectCanaryLeak(bounded).leaked) {
      return boundedSafeTemplate(environmentKey, subjectKey);
    }
  } catch {
    return boundedSafeTemplate(environmentKey, subjectKey);
  }
  return bounded;
}

export function renderRedAlert(
  environmentKey: string,
  subjectKey: string,
  evidenceCount: number,
): string {
  return guard(
    `CloudIT RED alert [environment=${environmentKey} subject=${subjectKey}] category=RED evidence=${evidenceCount}. Review the operations portal for details.`,
    environmentKey,
    subjectKey,
  );
}

export function renderRecovery(
  environmentKey: string,
  subjectKey: string,
  category: string,
  evidenceCount: number,
): string {
  return guard(
    `CloudIT recovery notice [environment=${environmentKey} subject=${subjectKey}] category=${category} evidence=${evidenceCount}. Subject cleared; monitoring continues.`,
    environmentKey,
    subjectKey,
  );
}

export type DigestPeriod = 'daily' | 'weekly' | 'monthly';

export interface DigestLineInput {
  subjectKey: string;
  category: string;
}

export function renderDigest(
  environmentKey: string,
  period: DigestPeriod,
  entries: readonly DigestLineInput[],
): string {
  const counts: Record<string, number> = { RED: 0, AMBER: 0, GREEN: 0, NO_DATA: 0, UNKNOWN: 0 };
  for (const entry of entries) {
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  }
  const header =
    `CloudIT ${period} digest [environment=${environmentKey}] entries=${entries.length} ` +
    `RED=${counts.RED} AMBER=${counts.AMBER} GREEN=${counts.GREEN} NO_DATA=${counts.NO_DATA} UNKNOWN=${counts.UNKNOWN}`;
  const lines = entries.map((entry) => `${entry.subjectKey}: ${entry.category}`);
  return guard([header, ...lines].join('\n'), environmentKey, 'digest');
}
