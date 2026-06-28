// Global difficulty scaling. The primary lever is the per-wave enemy-count scaler, plus
// hull / shield / fire-rate multipliers. d = 1 is "normal" (identity). [tasks T4.3, design §10,
// ROC-ENM-12,14, ROC-DIF-1,2]

export interface DifficultyScale {
  count: number;
  hull: number;
  shield: number;
  fireRate: number;
}

export function difficultyScale(d: number): DifficultyScale {
  const k = Math.max(0, d - 1); // how far above normal
  return {
    count: Math.max(0, d), // enemy count is the primary lever [ROC-ENM-14]
    hull: 1 + k * 0.6,
    shield: 1 + k * 0.5,
    fireRate: 1 + k * 0.5,
  };
}

// Scale a base wave count by difficulty (at least one enemy).
export function scaledCount(base: number, d: number): number {
  return Math.max(1, Math.round(base * difficultyScale(d).count));
}
