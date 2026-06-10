import type { EventBatch } from './eventsApi';

const parseDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isBatchActiveNow = (batch: EventBatch, referenceDate = new Date()) => {
  if (!batch.isActive) return false;

  const startDate = parseDate(batch.startDate);
  const endDate = parseDate(batch.endDate);
  if (!startDate || !endDate) return false;

  const withinWindow = referenceDate >= startDate && referenceDate <= endDate;
  if (!withinWindow) return false;

  const seatsAvailable = getBatchAvailableSeats(batch);

  return seatsAvailable === null || seatsAvailable > 0;
};

export const hasActiveBatchNow = (batches: EventBatch[], referenceDate = new Date()) =>
  batches.some((batch) => isBatchActiveNow(batch, referenceDate));

export const getBatchAvailableSeats = (batch: EventBatch) => {
  if (typeof batch.vagasDisponiveis === 'number') {
    return batch.vagasDisponiveis;
  }
  if (typeof batch.maxQuantity === 'number') {
    const used = typeof batch.currentQuantity === 'number' ? Number(batch.currentQuantity) : 0;
    return Math.max(0, batch.maxQuantity - used);
  }
  return null;
};

export const getActiveBatches = (batches: EventBatch[], referenceDate = new Date()) =>
  batches.filter((batch) => isBatchActiveNow(batch, referenceDate));

export const sumAvailableSeats = (batches: EventBatch[]) => {
  let total = 0;
  for (const batch of batches) {
    const seats = getBatchAvailableSeats(batch);
    if (seats === null) {
      return null;
    }
    total += seats;
  }
  return total;
};
