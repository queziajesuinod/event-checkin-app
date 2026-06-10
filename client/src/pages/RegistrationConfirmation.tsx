import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { consultarInscricao } from '@/lib/eventsApi';
import { getCieloDeniedMessage } from '@/lib/paymentDenialReason';
import { extractImagePalette, type ImagePalette } from '@/lib/imagePalette';

export default function RegistrationConfirmation() {
  const [, params] = useRoute('/inscricao/:orderCode');
  const [, setLocation] = useLocation();
  const orderCode = params?.orderCode;

  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const [palette, setPalette] = useState<ImagePalette | null>(null);

  useEffect(() => {
    let active = true;
    const imageUrl = registration?.event?.imageUrl;
    if (!imageUrl) {
      setPalette(null);
      return;
    }
    extractImagePalette(imageUrl).then((p) => {
      if (active) setPalette(p);
    });
    return () => {
      active = false;
    };
  }, [registration?.event?.imageUrl]);

  useEffect(() => {
    if (!orderCode) {
      setLocation('/eventos');
      return;
    }
    carregarInscricao();
  }, [orderCode]);

  const carregarInscricao = async () => {
    try {
      setLoading(true);
      const data = await consultarInscricao(orderCode!);
      setRegistration(data);

      // Se for PIX e estiver pendente, iniciar polling
      if (data.paymentMethod === 'pix' && data.paymentStatus === 'pending') {
        iniciarPolling();
      }
    } catch (error) {
      console.error('Erro ao carregar inscrição:', error);
      toast.error('Erro ao carregar dados da inscrição');
    } finally {
      setLoading(false);
    }
  };

  const iniciarPolling = () => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const data = await consultarInscricao(orderCode!);
        setRegistration(data);

        if (data.paymentStatus !== 'pending') {
          clearInterval(interval);
          setPolling(false);
          if (data.paymentStatus === 'confirmed') {
            toast.success('Pagamento confirmado!');
          }
        }
      } catch (error) {
        console.error('Erro no polling:', error);
      }
    }, 5000);

    // Parar apos 10 minutos
    setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 600000);
  };

  const copiarPixCode = () => {
    if (registration?.pixQrCode) {
      navigator.clipboard.writeText(registration.pixQrCode);
      toast.success('Código PIX copiado!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm w-full space-y-4">
          <p className="font-medium text-slate-700">Inscrição não encontrada</p>
          <Button onClick={() => setLocation('/eventos')} className="w-full">
            Voltar para eventos
          </Button>
        </div>
      </div>
    );
  }

  const isPix = registration.paymentMethod === 'pix';
  const normalizedStatus = String(registration.paymentStatus || '').toLowerCase();
  const isPending = ['pending', 'waiting', 'authorized', 'notfinished'].includes(normalizedStatus);
  const isConfirmed = ['confirmed', 'paid', 'captured'].includes(normalizedStatus);
  const isDenied = ['failed', 'denied', 'deniedbycielo', 'canceled', 'cancelled', 'aborted'].includes(normalizedStatus);
  const deniedReasonMessage = getCieloDeniedMessage(registration);

  const statusBg = isConfirmed
    ? 'from-green-500 to-green-600'
    : isDenied
    ? 'from-red-500 to-red-600'
    : 'from-amber-400 to-amber-500';

  const statusIcon = isConfirmed ? (
    <CheckCircle className="h-14 w-14 text-white drop-shadow" />
  ) : isDenied ? (
    <Clock className="h-14 w-14 text-white drop-shadow" />
  ) : (
    <Clock className="h-14 w-14 text-white drop-shadow animate-pulse" />
  );

  const statusTitle = isConfirmed
    ? 'Inscrição Confirmada!'
    : isDenied
    ? 'Pagamento não autorizado'
    : 'Aguardando Pagamento';

  return (
    <div className="min-h-screen relative py-10 px-4">
      {/* Background fixo — imagem do evento com blur + overlay */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {registration.event?.imageUrl ? (
          <>
            <img
              src={registration.event.imageUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover scale-105 blur-[2px]"
            />
            <div
              className="absolute inset-0 bg-slate-900/60"
              style={
                palette
                  ? { background: `linear-gradient(to bottom, ${palette.overlay}, ${palette.overlayStrong})` }
                  : undefined
              }
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800" />
        )}
      </div>

      <div className="container max-w-lg mx-auto space-y-5">

        {/* Status header */}
        <div className={`rounded-2xl bg-gradient-to-b ${statusBg} p-8 text-center text-white`}>
          <div className="flex justify-center mb-4">{statusIcon}</div>
          <h1 className="text-2xl font-bold">{statusTitle}</h1>
          <p className="text-sm mt-1 text-white/80">Código: {registration.orderCode}</p>
        </div>

        {/* Resumo */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl divide-y divide-slate-100">
          <div className="flex justify-between items-center px-5 py-3.5 text-sm">
            <span className="text-slate-500">Quantidade</span>
            <span className="font-medium text-slate-900">{registration.quantity} inscrito(s)</span>
          </div>
          <div className="flex justify-between items-center px-5 py-3.5 text-sm">
            <span className="text-slate-500">Status</span>
            <span
              className={`font-semibold ${
                isConfirmed ? 'text-green-600' : isDenied ? 'text-red-600' : 'text-amber-600'
              }`}
            >
              {isConfirmed ? 'Confirmado' : isDenied ? 'Negado' : 'Pendente'}
            </span>
          </div>
          <div className="flex justify-between items-center px-5 py-4 font-bold">
            <span className="text-slate-700">Total</span>
            <span className="text-lg text-primary" style={palette ? { color: palette.accent } : undefined}>
              R$ {Number(registration.finalPrice).toFixed(2)}
            </span>
          </div>
        </div>

        {/* PIX pendente */}
        {isPix && isPending && (
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-6 space-y-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <QrCode
                className="h-5 w-5 text-slate-400"
                style={palette ? { color: palette.accent } : undefined}
              />
              Pagar com PIX
            </h3>

            {registration.pixQrCodeBase64 && (
              <div className="flex justify-center">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <img
                    src={`data:image/png;base64,${registration.pixQrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-56 h-56"
                  />
                </div>
              </div>
            )}

            {registration.pixQrCode && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                  Ou copie o código PIX
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={registration.pixQrCode}
                    readOnly
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 text-slate-700"
                  />
                  <Button onClick={copiarPixCode} variant="outline" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {polling && (
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                <span className="text-sm text-blue-800">Aguardando confirmação do pagamento...</span>
              </div>
            )}
          </div>
        )}

        {/* Pagamento aprovado (não PIX) */}
        {!isPix && isConfirmed && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
            <p className="font-semibold text-green-800">Pagamento aprovado!</p>
            <p className="text-sm text-green-700 mt-1">
              Você receberá um e-mail com os detalhes da sua inscrição.
            </p>
          </div>
        )}

        {/* Pagamento negado */}
        {isDenied && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <p className="font-semibold text-red-800">Pagamento não autorizado</p>
            <p className="text-sm text-red-700 mt-1">
              {deniedReasonMessage || 'Revise os dados de pagamento e tente novamente.'}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <Button
            onClick={() => setLocation('/eventos')}
            variant="outline"
            className="flex-1 bg-white/90 backdrop-blur-sm text-slate-700 border-white/60 hover:bg-white hover:text-slate-900 shadow-lg"
          >
            Voltar para eventos
          </Button>
          {isPending && (
            <Button
              onClick={carregarInscricao}
              variant="outline"
              className="bg-white/90 backdrop-blur-sm text-slate-700 border-white/60 hover:bg-white hover:text-slate-900 shadow-lg"
            >
              Atualizar status
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
