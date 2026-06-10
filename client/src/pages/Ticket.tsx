import { useEffect, useState, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

interface Registration {
  id: string;
  orderCode: string;
  event: {
    id: string;
    name?: string;
    title: string;
    imageUrl?: string;
    eventDate?: string | null;
    startDate?: string | null;
    location: string;
  };
  attendees: Array<{
    id: string;
    attendeeData: {
      nome_completo?: string;
      nome_do_inscrito?: string;
      nome?: string;
    };
    batch: {
      name: string;
      price: number;
    };
  }>;
  finalPrice: number;
  paidTotal?: number;
  paymentStatus: string;
  remaining?: number;
  payments?: Array<{
    amount: number;
    status?: string | null;
  }>;
}

const EVENT_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const BRAZILIAN_DATE_REGEX =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const parseEventDateString = (value?: string | null): Date | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const brazilMatch = BRAZILIAN_DATE_REGEX.exec(trimmed);
  if (brazilMatch) {
    const [, day, month, year, hour, minute, second] = brazilMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour ?? '0'),
      Number(minute ?? '0'),
      Number(second ?? '0')
    );
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const firstSpaceIndex = trimmed.indexOf(' ');
  const normalized =
    firstSpaceIndex > -1 && !trimmed.includes('T')
      ? `${trimmed.substring(0, firstSpaceIndex)}T${trimmed.substring(
          firstSpaceIndex + 1
        )}`
      : trimmed;
  const withTimezone = normalized.replace(/\s+([+-]\d{2}:\d{2})$/, '$1');

  const isoParsed = new Date(withTimezone);
  if (!Number.isNaN(isoParsed.getTime())) {
    return isoParsed;
  }

  const fallbackTimestamp = Date.parse(trimmed);
  if (!Number.isNaN(fallbackTimestamp)) {
    return new Date(fallbackTimestamp);
  }

  return null;
};

const formatEventDateLabel = (event: Registration['event']) => {
  const rawDate =
    event.eventDate?.trim() ||
    event.startDate?.trim() ||
    '';
  if (!rawDate) {
    return 'Data indisponível';
  }
  const parsed = parseEventDateString(rawDate);
  if (parsed) {
    return parsed.toLocaleDateString('pt-BR', EVENT_DATE_FORMAT_OPTIONS);
  }
  return rawDate;
};

const formatEventDateRange = (event: Registration['event']) => {
  const startDate = parseEventDateString(event.startDate);
  const endDate = parseEventDateString(event.eventDate);

  if (startDate && endDate) {
    const start = startDate.toLocaleDateString('pt-BR');
    const end = endDate.toLocaleDateString('pt-BR');
    return `${start} a ${end}`;
  }

  if (startDate) {
    return startDate.toLocaleDateString('pt-BR');
  }

  if (endDate) {
    return endDate.toLocaleDateString('pt-BR');
  }

  return formatEventDateLabel(event);
};

const TicketDivider = () => (
  <div className="h-px w-full bg-border/50" role="presentation" />
);

const detectPdfImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' => {
  const match = dataUrl.match(/^data:image\/([^;]+);base64,/i);
  if (!match) {
    return 'PNG';
  }
  const mime = match[1].toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    return 'JPEG';
  }
  if (mime.includes('webp')) {
    return 'WEBP';
  }
  return 'PNG';
};

const createCircularPngDataUrl = async (dataUrl: string, size = 256): Promise<string | null> => {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, 0, 0, size, size);
    ctx.restore();

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

const normalizeStatus = (status?: string | null) =>
  (status ?? '').trim().toLowerCase();

const isCancelledStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return normalized === 'cancelled' || normalized === 'canceled' || normalized === 'refunded';
};

export default function Ticket() {
  const [match, params] = useRoute('/ticket/:orderCode');
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [attendeeQRCodes, setAttendeeQRCodes] = useState<Record<string, string>>({});
  const [eventImageDataUrl, setEventImageDataUrl] = useState<string | null>(null);

  const loadRegistration = useCallback(async (orderCode: string) => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';
      const response = await fetch(`${API_URL}/api/public/events/registrations/${orderCode}`);
      
      if (!response.ok) {
        throw new Error('Inscrição não encontrada');
      }

      const data: Registration = await response.json();
      setRegistration(data);

      const cancelled = isCancelledStatus(data.paymentStatus);
      setAttendeeQRCodes({});

      if (cancelled) {
        return;
      }

      const eventId = data.event?.id ?? '';
      const qrEntries = await Promise.all(
        data.attendees.map(async (attendee: Registration['attendees'][number]) => {
          try {
            const payload = JSON.stringify({
              orderCode: data.orderCode,
              event_id: eventId,
              attendeeId: attendee.id,
            });
            const url = await QRCode.toDataURL(payload, {
              width: 250,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF',
              },
            });
            return [attendee.id, url] as const;
          } catch {
            return [attendee.id, ''] as const;
          }
        })
      );
      setAttendeeQRCodes(Object.fromEntries(qrEntries));
    } catch (error) {
      toast.error('Erro', {
        description: 'Não foi possível carregar os dados da inscrição',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const imageUrl = registration?.event?.imageUrl;
    if (!imageUrl) {
      setEventImageDataUrl(null);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok || canceled) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (canceled) return;
          if (typeof reader.result === 'string') {
            setEventImageDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        setEventImageDataUrl(null);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [registration?.event?.imageUrl]);

  useEffect(() => {
    if (!match || !params?.orderCode) {
      navigate('/');
      return;
    }

    loadRegistration(params.orderCode);
  }, [match, params?.orderCode, navigate, loadRegistration]);

  const safeText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

  const downloadTicket = async () => {
    if (!registration) return;

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const dateRangeLabel = formatEventDateRange(registration.event);
      const headerDetailText = `${dateRangeLabel} • ${safeText(registration.event.location)}`;
      let yOffset = margin;
      const circularHeaderImageDataUrl = eventImageDataUrl
        ? await createCircularPngDataUrl(eventImageDataUrl)
        : null;

      const headerImageSize = 48;
      const headerTextGap = 10;

      const drawFullHeader = () => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
       
        const headerTextX = margin + headerImageSize + headerTextGap;
        const headerTextWidth = pageWidth - headerTextX - margin;
        const headerNameLines = pdf.splitTextToSize(
          safeText(registration.event.title),
          headerTextWidth
        );
        const headerDetailLines = pdf.splitTextToSize(headerDetailText, headerTextWidth);

        if (circularHeaderImageDataUrl) {
          pdf.addImage(
            circularHeaderImageDataUrl,
            'PNG',
            margin,
            margin,
            headerImageSize,
            headerImageSize
          );
        } else if (eventImageDataUrl) {
          const format = detectPdfImageFormat(eventImageDataUrl);
          pdf.addImage(eventImageDataUrl, format, margin, margin, headerImageSize, headerImageSize);
        } else {
          pdf.setFillColor(244, 244, 244);
          pdf.setDrawColor(220);
          pdf.rect(margin, margin, headerImageSize, headerImageSize, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(26);
          const initial = (registration.event.title?.charAt(0) || '?').toUpperCase();
          pdf.text(
            initial,
            margin + headerImageSize / 2,
            margin + headerImageSize / 2 + 9,
            { align: 'center' }
          );
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(0);
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        const textStartY = margin + 16;
        headerNameLines.forEach((line: string, index: number) => {
          pdf.text(line, headerTextX, textStartY + index * 7);
        });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const detailStartY = textStartY + headerNameLines.length * 7 + 5;
        headerDetailLines.forEach((line: string, index: number) => {
          pdf.text(line, headerTextX, detailStartY + index * 5.5);
        });

        const headerTextEndY = detailStartY + headerDetailLines.length * 5.5;
        const headerHeight = Math.max(headerImageSize, headerTextEndY - margin);
        yOffset = margin + headerHeight + 12;

        pdf.setDrawColor(200);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yOffset - 8, pageWidth - margin, yOffset - 8);
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.2);
        yOffset += 6;
      };

      const drawMiniHeader = () => {
        const miniWidth = pageWidth - margin * 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        const titleLines = pdf.splitTextToSize(safeText(registration.event.title), miniWidth);
        titleLines.forEach((line: string, index: number) => {
          pdf.text(line, margin, margin + 10 + index * 6);
        });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const detailLines = pdf.splitTextToSize(headerDetailText, miniWidth);
        const detailStartY = margin + 10 + titleLines.length * 6 + 5;
        detailLines.forEach((line: string, index: number) => {
          pdf.text(line, margin, detailStartY + index * 5);
        });

        yOffset = detailStartY + detailLines.length * 5 + 8;
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yOffset - 6, pageWidth - margin, yOffset - 6);
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.2);
        yOffset += 6;
      };

      drawFullHeader();

      const attendeesPerPage = 4;
      const cardHeight = 40;
      const cardSpacing = 7;
      const qrSize = 24;
      const qrX = pageWidth - margin - qrSize;
      const cardTextWidth = pageWidth - margin * 2 - qrSize - 14;
      const requiredPageHeight =
        attendeesPerPage * cardHeight + (attendeesPerPage - 1) * cardSpacing;
      const pageBottomLimit = pageHeight - margin;
      let attendeeIndexOnPage = 0;

      if (yOffset + requiredPageHeight > pageBottomLimit) {
        pdf.addPage();
        drawMiniHeader();
      }

      registration.attendees.forEach((attendee, index) => {
        if (index > 0 && index % attendeesPerPage === 0) {
          pdf.addPage();
          drawMiniHeader();
          attendeeIndexOnPage = 0;
        }

        const participantName =
          attendee.attendeeData.nome_completo ||
          attendee.attendeeData.nome_do_inscrito ||
          attendee.attendeeData.nome ||
          `Inscrito ${index + 1}`;
        const nameLine = pdf.splitTextToSize(
          `Participante: ${safeText(participantName)}`,
          cardTextWidth
        )[0];
        const lotLine = pdf.splitTextToSize(
          `Lote: ${safeText(attendee.batch.name)}`,
          cardTextWidth
        )[0];

        const cardTop = yOffset + attendeeIndexOnPage * (cardHeight + cardSpacing);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(nameLine, margin, cardTop + 11);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(lotLine, margin, cardTop + 18);
        pdf.text(`Código: ${safeText(registration.orderCode)}`, margin, cardTop + 25);

        const qrY = cardTop + (cardHeight - qrSize) / 2;
        const attendeeQr = attendeeQRCodes[attendee.id];
        if (attendeeQr) {
          pdf.addImage(attendeeQr, 'PNG', qrX, qrY, qrSize, qrSize);
        } else {
          pdf.setDrawColor(200);
          pdf.rect(qrX, qrY, qrSize, qrSize);
          pdf.setDrawColor(0);
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.text(`${index + 1}/${registration.attendees.length}`, qrX + qrSize / 2, cardTop + cardHeight - 4, {
          align: 'center',
        });

        (pdf as any).setLineDash([3, 1]);
        pdf.setDrawColor(200);
        pdf.line(margin, cardTop + cardHeight, pageWidth - margin, cardTop + cardHeight);
        (pdf as any).setLineDash([]);
        pdf.setDrawColor(0);

        attendeeIndexOnPage += 1;
      });

      pdf.save(`ticket-${registration.orderCode}.pdf`);

      toast.success('Sucesso!', {
        description: 'Ticket baixado com sucesso',
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro', {
        description: 'Não foi possível gerar o PDF',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!registration) {
    return null;
  }

  const eventDateLabel = formatEventDateLabel(registration.event);
  const eventThumbnailSrc = eventImageDataUrl || registration.event.imageUrl;
  const eventInitial = (registration.event.title?.charAt(0) || '?').toUpperCase();

  const normalizedPaymentStatus = normalizeStatus(registration.paymentStatus);
  const isCancelled = isCancelledStatus(registration.paymentStatus);
  const payments = Array.isArray(registration.payments) ? registration.payments : [];
  const valorPagoPorAmount = payments
    .filter((payment) => {
      const status = normalizeStatus(payment.status);
      return status === 'confirmed' || status === 'paid' || status === 'captured';
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const valorPago =
    payments.length > 0
      ? valorPagoPorAmount
      : registration.paidTotal ?? (registration.finalPrice - (registration.remaining ?? 0));
  const valorRestante =
    payments.length > 0
      ? Math.max(0, registration.finalPrice - valorPago)
      : registration.remaining ?? 0;
  const isPartial = normalizedPaymentStatus === 'partial';
  const isPaid =
    !isCancelled &&
    !isPartial &&
    (normalizedPaymentStatus === 'confirmed' ||
      normalizedPaymentStatus === 'paid' ||
      valorRestante <= 0);

  const formatBRL = (value: number) =>
    `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <div className="container max-w-2xl mx-auto space-y-6">
        {/* Header de Status */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div
              className={`p-3 rounded-full ${
                isCancelled ? 'bg-rose-100' : 'bg-green-100'
              }`}
            >
              {isCancelled ? (
                  <XCircle className="w-12 h-12 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              )}
            </div>
          </div>
          <h1
            className={`text-3xl font-bold ${
              isCancelled ? 'text-rose-600' : 'text-green-600'
            }`}
          >
            {isCancelled ? 'Inscrição Cancelada' : 'Inscrição Confirmada!'}
          </h1>
          <p className={isCancelled ? 'text-rose-600' : 'text-muted-foreground'}>
            Código: <span className="font-mono font-bold">{registration.orderCode}</span>
          </p>
        </div>

        {/* Card do Ticket */}
        <Card>
          <CardHeader
            className={`bg-gradient-to-r ${
              isCancelled
                ? 'from-rose-500 to-rose-600'
                : 'from-primary to-primary/80'
            } text-white`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border border-white/40 bg-white/10 overflow-hidden flex items-center justify-center">
                  {eventThumbnailSrc ? (
                    <img
                      src={eventThumbnailSrc}
                      alt={registration.event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white/80">
                      {eventInitial}
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-white">
                  <h2 className="text-2xl font-bold leading-tight">
                    {registration.event.title}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <Calendar className="w-4 h-4" />
                    <span>{eventDateLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <MapPin className="w-4 h-4" />
                    <span>{registration.event.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Código: <span className="font-mono font-bold">{registration.orderCode}</span>
              </p>
              {isCancelled && (
                <p className="text-sm text-rose-100 mt-2">
                  Esta inscrição foi cancelada e não possui QR Code válido.
                </p>
              )}
            </div>

            {!isCancelled && (
              <>
                {/* Aviso de pagamento parcial acima dos QR codes */}
                {isPartial && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-amber-800">
                      ⏳ Pagamento parcial — saldo pendente: {formatBRL(valorRestante)}
                    </p>
                    <p className="text-xs text-amber-700">
                      Seu QR Code já está disponível, mas a participação só estará garantida após a quitação.
                    </p>
                    <button
                      onClick={() => navigate(`/inscricao/${registration.orderCode}/visualizacao`)}
                      className="self-start text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700 transition-colors"
                    >
                      Quitar pagamento →
                    </button>
                  </div>
                )}

                {/* QR Code por inscrito */}
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {registration.attendees.map((attendee, index) => {
                      const nome =
                        attendee.attendeeData.nome_completo ||
                        attendee.attendeeData.nome_do_inscrito ||
                        attendee.attendeeData.nome ||
                        `Inscrito ${index + 1}`;
                      const attendeeQr = attendeeQRCodes[attendee.id];

                      return (
                        <div
                          key={attendee.id}
                          className={`bg-white p-3 rounded-lg border flex flex-col items-center ${
                            isPartial ? 'border-amber-200 opacity-80' : 'border-dashed'
                          }`}
                        >
                          {attendeeQr ? (
                            <img
                              src={attendeeQr}
                              alt={`QR Code de ${nome}`}
                              className="w-32 h-32 object-contain"
                            />
                          ) : (
                            <div className="w-32 h-32 flex items-center justify-center text-[10px] text-muted-foreground">
                              QR Code sendo gerado...
                            </div>
                          )}
                          <p className="mt-2 text-sm font-semibold text-center">{nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Lote: {attendee.batch.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {isPartial
                      ? 'QR Code gerado — quite o saldo para garantir sua entrada'
                      : 'Apresente o QR Code correspondente ao seu nome na entrada do evento'}
                  </p>
                </div>
              </>
            )}
            <TicketDivider />

            {/* Inscritos */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Inscritos</h3>
              </div>
              <div className="space-y-2">
                {registration.attendees.map((attendee, index) => (
                  <div key={attendee.id} className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {attendee.attendeeData.nome_completo ||
                            attendee.attendeeData.nome_do_inscrito ||
                            attendee.attendeeData.nome ||
                            `Inscrito ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Lote: {attendee.batch.name}
                        </p>
                      </div>
                      <p className="font-semibold">
                        R$ {Number(attendee.batch.price).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <TicketDivider />

            {/* Total / Parcial */}
            {isPartial ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor total</span>
                  <span className="font-medium">{formatBRL(registration.finalPrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor pago</span>
                  <span className="font-semibold text-green-700">{formatBRL(valorPago)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Saldo restante</span>
                  <span className="font-semibold text-amber-700">{formatBRL(valorRestante)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Pago</span>
                <span className="text-primary">{formatBRL(registration.finalPrice)}</span>
              </div>
            )}

            {/* Status do Pagamento */}
            <div
              className={`p-3 rounded-lg ${
                isCancelled ? 'bg-rose-50' : isPartial ? 'bg-amber-50' : isPaid ? 'bg-green-50' : 'bg-yellow-50'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  isCancelled ? 'text-rose-700' : isPartial ? 'text-amber-700' : isPaid ? 'text-green-700' : 'text-yellow-700'
                }`}
              >
                {isCancelled
                  ? 'Inscrição Cancelada'
                  : isPartial
                  ? '⏳ Pagamento parcial — há saldo a quitar'
                  : isPaid
                  ? '✓ Pagamento Confirmado'
                  : '⌛ Aguardando Pagamento'}
              </p>
            </div>

            {/* Botão de quitação para pagamento parcial */}
            {isPartial && (
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                size="lg"
                onClick={() => navigate(`/inscricao/${registration.orderCode}/visualizacao`)}
              >
                Quitar saldo restante ({formatBRL(valorRestante)})
              </Button>
            )}

            {!isCancelled && !isPartial ? (
              <>
                <Button onClick={downloadTicket} className="w-full" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Ticket (PDF)
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Guarde este ticket! Você precisará dele para entrar no evento.
                </p>
              </>
            ) : isCancelled ? (
              <p className="text-xs text-center text-rose-600">
                Este pedido foi cancelado e não é possível gerar ou apresentar o ticket.
              </p>
            ) : null}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

