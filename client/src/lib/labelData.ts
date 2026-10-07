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

  // Mapa de campos do formulário (comprador + inscrito) para campos arbitrários da etiqueta.
  // Inscrito tem precedência sobre comprador em caso de mesma chave.
  const fields: Record<string, string> = {};
  const toStr = (v: unknown) => (v == null ? '' : String(v));
  if (reg?.buyerData) Object.entries(reg.buyerData).forEach(([k, v]) => { fields[k] = toStr(v); });
  if (att?.attendeeData) Object.entries(att.attendeeData).forEach(([k, v]) => { fields[k] = toStr(v); });

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
    fields,
  };
  return { template: tplResp.template, items: [item] };
}

/**
 * Monta as etiquetas de TODOS os inscritos de um pedido (modelo do evento +
 * dados do lookup público). Usado na tela do ingresso para imprimir as etiquetas
 * direto na impressora, no formato da etiqueta.
 * Retorna null se o evento não tem modelo de etiqueta configurado.
 */
export async function montarEtiquetasPedido(
  eventId: string,
  orderCode: string,
): Promise<{ template: LabelTemplateResponse['template']; items: LabelRenderItem[] } | null> {
  const [tplResp, registros] = await Promise.all([
    buscarModeloEtiqueta(eventId),
    buscarIngressosPublico(orderCode),
  ]);
  if (!tplResp?.template) return null;

  const reg = registros.find((r) => r.orderCode === orderCode);
  const toStr = (v: unknown) => (v == null ? '' : String(v));

  const items: LabelRenderItem[] = (reg?.attendees || []).map((att) => {
    const fields: Record<string, string> = {};
    if (reg?.buyerData) Object.entries(reg.buyerData).forEach(([k, v]) => { fields[k] = toStr(v); });
    if (att.attendeeData) Object.entries(att.attendeeData).forEach(([k, v]) => { fields[k] = toStr(v); });
    return {
      key: `${reg!.orderCode}-${att.id}`,
      attendeeName: att.name,
      sector: att.batch?.sector || '',
      batchName: att.batch?.name || '',
      eventTitle: tplResp.event.title,
      orderCode: reg!.orderCode,
      attendeeId: att.id,
      eventId,
      eventImage: tplResp.event.imageUrl || null,
      fields,
    };
  });

  return { template: tplResp.template, items };
}
