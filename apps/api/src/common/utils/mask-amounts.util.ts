const MONETARY_KEYS = new Set([
  'priceFcfa',
  'unitPriceFcfa',
  'totalPriceFcfa',
  'totalFcfa',
  'subtotalHtFcfa',
  'balanceFcfa',
  'paidAmountFcfa',
  'depositFcfa',
  'discountFcfa',
  'tourismTaxFcfa',
  'serviceAmountFcfa',
  'vatAmountFcfa',
  'amountFcfa',
  'pricePerNight',
  'totalBilledTodayFcfa',
  'totalCollectedTodayFcfa',
  'totalOutstandingFcfa',
  'caTotalFcfa',
  'caHebergementFcfa',
  'caRestaurantFcfa',
  'revparFcfa',
  'adrFcfa',
  'revenueFcfa',
]);

/**
 * Supprime ou masque récursivement les montants FCFA dans une réponse API
 * lorsqu'un utilisateur ne possède pas le droit « voir_montants ».
 */
export function maskAmountsInPayload<T>(payload: T): T {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return payload;
  }
  if (payload instanceof Date) {
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => maskAmountsInPayload(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    if (MONETARY_KEYS.has(key) || /Fcfa$/.test(key)) {
      copy[key] = null;
    } else {
      copy[key] = maskAmountsInPayload(val);
    }
  }
  return copy as T;
}
