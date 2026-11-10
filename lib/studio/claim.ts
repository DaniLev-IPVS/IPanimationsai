export type Candidate = { id: string; tokens: number; mine: boolean; finished: number };

const MAX_STEPS = 200000;

/**
 * BytePlus says how many requests and tokens a key used in an hour, but not
 * which renders they were. Token counts are large and specific, so the renders
 * that add up exactly identify themselves. Returns their ids, or null when no
 * set adds up or two different sets do. Renders with the same token count are
 * interchangeable: ones already claimed come first, then the earliest finished.
 */
export function pickRenders(candidates: Candidate[], requests: number, tokens: number): string[] | null {
  const groups = new Map<number, Candidate[]>();
  for (const c of candidates) {
    if (c.tokens <= 0) continue;
    groups.set(c.tokens, [...(groups.get(c.tokens) || []), c]);
  }
  const values = Array.from(groups.keys()).sort((a, b) => b - a);
  const counts: number[] = values.map(() => 0);
  let solution: number[] | null = null;
  let solutions = 0;
  let steps = 0;

  const walk = (i: number, leftRequests: number, leftTokens: number) => {
    if (solutions > 1 || ++steps > MAX_STEPS) return;
    if (i === values.length) {
      if (leftRequests === 0 && leftTokens === 0) {
        solutions++;
        solution = counts.slice();
      }
      return;
    }
    const value = values[i];
    const most = Math.min((groups.get(value) as Candidate[]).length, leftRequests, Math.floor(leftTokens / value));
    for (let n = most; n >= 0; n--) {
      counts[i] = n;
      walk(i + 1, leftRequests - n, leftTokens - n * value);
    }
    counts[i] = 0;
  };
  walk(0, requests, tokens);

  if (solutions !== 1 || steps > MAX_STEPS || !solution) return null;
  const chosen: number[] = solution;
  return values.flatMap((value, i) =>
    (groups.get(value) as Candidate[])
      .slice()
      .sort((a, b) => Number(b.mine) - Number(a.mine) || a.finished - b.finished)
      .slice(0, chosen[i])
      .map((c) => c.id),
  );
}
