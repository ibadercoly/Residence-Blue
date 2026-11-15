export function formatRapportsFcfa(amount: number | undefined | null): string {
  const safe = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(safe)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

export function formatRapportsDeltaPhrase(deltaPercent: number): string {
  const abs = Math.abs(Math.round(deltaPercent));
  if (deltaPercent > 0) {
    return `▲ ${abs} % de plus que la période précédente`;
  }
  if (deltaPercent < 0) {
    return `▼ ${abs} % de moins que la période précédente`;
  }
  return 'Identique à la période précédente';
}
