export const MAX_DELIVERY_ATTEMPTS = 5;

/** Délai avant la prochaine tentative : 2, 4, 8, 16 minutes… plafonné à 2 h. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(120, 2 ** Math.max(1, attempts));
}

export function nextDeliveryState(attempts: number): { status: 'pending' | 'failed'; delayMinutes: number } {
  if (attempts >= MAX_DELIVERY_ATTEMPTS) return { status: 'failed', delayMinutes: 0 };
  return { status: 'pending', delayMinutes: retryDelayMinutes(attempts) };
}
