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

// Lote cuja janela de inscrição ainda vai abrir (começa no futuro) e que tem vaga.
// Serve para separar "Próximos eventos" (inscrição vai abrir) de "Inscrições
// fechadas" (esgotado ou janela já encerrada).
export const isBatchUpcoming = (batch: EventBatch, referenceDate = new Date()) => {
  if (!batch.isActive) return false;

  const startDate = parseDate(batch.startDate);
  const endDate = parseDate(batch.endDate);
  if (!startDate || !endDate) return false;

  if (referenceDate >= startDate) return false; // já começou (ou já passou)
  if (referenceDate > endDate) return false; // janela já encerrou

  const seatsAvailable = getBatchAvailableSeats(batch);
  return seatsAvailable === null || seatsAvailable > 0;
};

export const hasUpcomingBatch = (batches: EventBatch[], referenceDate = new Date()) =>
  batches.some((batch) => isBatchUpcoming(batch, referenceDate));

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
