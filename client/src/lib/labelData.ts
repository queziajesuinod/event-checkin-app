import { buscarModeloEtiqueta, buscarIngressosPublico, type LabelTemplateResponse } from './eventsApi';
import type { LabelRenderItem } from '@/components/LabelSheet';

/**
 * Monta os dados da etiqueta de um inscrito (modelo do evento + dados do lookup público).
 * Retorna null se o evento não tem modelo de etiqueta configurado.
 */
export async function montarEtiqueta(
  eventId: string,
  orderCode?: string,
  attendeeId?: string,
  fallbackName?: string,
): Promise<{ template: LabelTemplateResponse['template']; items: LabelRenderItem[] } | null> {
  const [tplResp, registros] = await Promise.all([
    buscarModeloEtiqueta(eventId),
    orderCode ? buscarIngressosPublico(orderCode) : Promise.resolve([]),
  ]);
  if (!tplResp?.template) return null;

  let name = fallbackName || '';
  let sector = '';
  let batchName = '';
  const reg = registros.find((r) => r.orderCode === orderCode);
  const att = reg?.attendees.find((a) => a.id === attendeeId);
  if (att) {
    name = att.name || name;
    sector = att.batch?.sector || '';
    batchName = att.batch?.name || '';
  }

  const item: LabelRenderItem = {
    key: `${orderCode || 'label'}-${attendeeId || '0'}`,
    attendeeName: name,
    sector,
    batchName,
    eventTitle: tplResp.event.title,
    orderCode: orderCode || '',
    attendeeId: attendeeId || '',
    eventId,
    eventImage: tplResp.event.imageUrl || null,
  };
  return { template: tplResp.template, items: [item] };
}
