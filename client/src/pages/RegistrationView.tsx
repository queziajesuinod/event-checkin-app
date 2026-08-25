import { useEffect, useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Check, CheckCircle2, CreditCard, Loader2, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getFriendlyPaymentError } from '@/lib/paymentErrorMessages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  buscarFormasPagamento,
  listarCamposFormulario,
  consultarInscricao,
  criarPagamentoInscricao,
  type CreateRegistrationPaymentPayload,
  type FormField,
  type PaymentOption,
  type RegistrationDetails,
  type RegistrationPayment,
} from '@/lib/eventsApi';

const formatFieldName = (name: string) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
import { maskCardExpiry, maskCreditCard, maskCVV, removeNonDigits } from '@/lib/masks';
import {
  calculateInstallmentInterestAmount,
  formatInstallmentInterest,
  getInstallmentInterestRule,
} from '@/lib/installmentInterest';

const normalizeStatus = (status?: string | null) =>
  (status ?? '').trim().toLowerCase();

const isCancelledStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return normalized === 'canceled' || normalized === 'cancelled' || normalized === 'refunded';
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatCurrency = (value: number | string) => {
  const n = typeof value === 'number' ? value : Number(value);
  return currencyFormatter.format(Number.isFinite(n) ? n : 0);
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const paymentStatusLabel: Record<RegistrationDetails['paymentStatus'], string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
};

const paymentStatusVariant: Record<RegistrationDetails['paymentStatus'], 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  partial: 'default',
  paid: 'default',
  confirmed: 'default',
  canceled: 'destructive',
  cancelled: 'destructive',
};

const methodLabel: Record<RegistrationPayment['method'], string> = {
  pix: 'PIX',
  credit_card: 'Cartão',
  cash: 'Dinheiro',
};

const channelLabel: Record<RegistrationPayment['channel'], string> = {
  ONLINE: 'Online',
  OFFLINE: 'Presencial',
};

const channelBadgeVariant: Record<RegistrationPayment['channel'], 'default' | 'secondary'> = {
  ONLINE: 'default',
  OFFLINE: 'secondary',
};

const statusBadgeVariant: Record<RegistrationPayment['status'], 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'default',
  failed: 'destructive',
  canceled: 'destructive',
};

const statusLabel: Record<RegistrationPayment['status'], string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  failed: 'Falhou',
  canceled: 'Cancelado',
};

const initialCardData = {
  cardNumber: '',
  cardHolder: '',
  expirationDate: '',
  securityCode: '',
};

const formatNumberInput = (value: number) => value.toFixed(2);

export default function RegistrationView() {
  const [, params] = useRoute('/inscricao/:orderCode/visualizacao');
  const [, setLocation] = useLocation();
  const orderCode = params?.orderCode;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registration, setRegistration] = useState<RegistrationDetails | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'pix' | 'credit_card'>('pix');
  const [amountMode, setAmountMode] = useState<'integral' | 'outro'>('integral');
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState('');
  const [loadingPaymentOptions, setLoadingPaymentOptions] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [installments, setInstallments] = useState(1);
  const [cardData, setCardData] = useState(initialCardData);
  const [copyingPixCode, setCopyingPixCode] = useState(false);
  const [pixSecondsLeft, setPixSecondsLeft] = useState(300);
  const [refreshingPix, setRefreshingPix] = useState(false);
  const [activePixQrCode, setActivePixQrCode] = useState<string | null>(null);
  const [activePixQrCodeBase64, setActivePixQrCodeBase64] = useState<string | null>(null);

  // Extracts PIX QR code from any response shape the backend may return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractPixQrCodes = (response: any): { pixQrCode: string | null; pixQrCodeBase64: string | null } => {
    // Primary: pagamento field (same format as first registration via EventDetails.tsx)
    if (response?.pagamento?.qrCodeString || response?.pagamento?.qrCodeBase64) {
      return {
        pixQrCode: response.pagamento.qrCodeString || null,
        pixQrCodeBase64: response.pagamento.qrCodeBase64 || null,
      };
    }
    // Fallback: top-level registration fields
    if (response?.pixQrCode || response?.pixQrCodeBase64) {
      return { pixQrCode: response.pixQrCode || null, pixQrCodeBase64: response.pixQrCodeBase64 || null };
    }
    // Fallback: nested in payments array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestPix = [...(response?.payments ?? [])].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).find((p: any) => p.method === 'pix' && p.status === 'pending');
    return {
      pixQrCode: latestPix?.pixQrCode || latestPix?.qrCodeString || null,
      pixQrCodeBase64: latestPix?.pixQrCodeBase64 || latestPix?.qrCodeBase64 || null,
    };
  };

  const handleCopyPixCode = async () => {
    const code = activePixQrCode || registration?.pixQrCode;
    if (!code) {
      toast.error('Código PIX não disponível');
      return;
    }
    try {
      setCopyingPixCode(true);
      await navigator.clipboard.writeText(code);
      toast.success('Código PIX copiado');
    } catch (error) {
      console.error('Erro ao copiar PIX code', error);
      toast.error('Não foi possível copiar o código PIX');
    } finally {
      setCopyingPixCode(false);
    }
  };

  const carregarInscricao = async () => {
    if (!orderCode) return;
    try {
      setLoading(true);
      const data = await consultarInscricao(orderCode);
      setRegistration(data);
    } catch (error) {
      console.error('Erro ao carregar inscrição:', error);
      toast.error('Não foi possível carregar os dados da inscrição');
    } finally {
      setLoading(false);
    }
  };

  const refreshPixQrCode = async () => {
    if (!orderCode) return;
    try {
      setRefreshingPix(true);
      const fresh = await consultarInscricao(orderCode);
      const { pixQrCode, pixQrCodeBase64 } = extractPixQrCodes(fresh);
      if (pixQrCode || pixQrCodeBase64) {
        setActivePixQrCode(pixQrCode);
        setActivePixQrCodeBase64(pixQrCodeBase64);
      }
      setRegistration(fresh);
      setPixSecondsLeft(300);
    } catch (error) {
      console.error('Erro ao atualizar QR Code PIX:', error);
      toast.error('Não foi possível atualizar o QR Code PIX.');
    } finally {
      setRefreshingPix(false);
    }
  };

  useEffect(() => {
    if (!orderCode) return;
    carregarInscricao();
  }, [orderCode]);

  useEffect(() => {
    if (method !== 'credit_card') {
      setCardData(initialCardData);
      setInstallments(1);
    }
  }, [method]);

  useEffect(() => {
    const eventId = registration?.event?.id;
    if (!eventId) {
      setPaymentOptions([]);
      setSelectedPaymentOptionId('');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingPaymentOptions(true);
        const options = await buscarFormasPagamento(eventId);
        if (cancelled) return;
        const activeOptions = options.filter(
          (opt) => opt.isActive && opt.eventId === eventId
        );
        setPaymentOptions(activeOptions);
      } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
      } finally {
        if (!cancelled) {
          setLoadingPaymentOptions(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registration?.event?.id]);

  useEffect(() => {
    const eventId = registration?.event?.id;
    if (!eventId) return;
    listarCamposFormulario(eventId)
      .then(setFormFields)
      .catch(() => setFormFields([]));
  }, [registration?.event?.id]);

  const sortedPayments = useMemo(() => {
    if (!registration) return [];
    const payments = Array.isArray(registration.payments) ? registration.payments : [];
    return [...payments].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [registration]);

  const normalizedPaymentStatus = normalizeStatus(registration?.paymentStatus);
  const isCancelled = isCancelledStatus(registration?.paymentStatus);
  const isPaid = registration
    ? !isCancelled &&
      (normalizedPaymentStatus === 'paid' ||
        normalizedPaymentStatus === 'confirmed' ||
        registration.remaining <= 0)
    : false;

  // Auto-refresh PIX QR code every 5 minutes
  useEffect(() => {
    const hasPendingPix = Boolean(activePixQrCodeBase64) && !isPaid && !isCancelled;
    if (!hasPendingPix) return;

    let seconds = 300;
    setPixSecondsLeft(seconds);

    const tick = setInterval(async () => {
      seconds--;
      setPixSecondsLeft(seconds);
      if (seconds <= 0) {
        seconds = 300;
        setPixSecondsLeft(300);
        if (orderCode) {
          try {
            const fresh = await consultarInscricao(orderCode);
            const { pixQrCode, pixQrCodeBase64 } = extractPixQrCodes(fresh);
            if (pixQrCode || pixQrCodeBase64) {
              setActivePixQrCode(pixQrCode);
              setActivePixQrCodeBase64(pixQrCodeBase64);
            }
            setRegistration(fresh);
          } catch {}
        }
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [activePixQrCode, registration?.pixQrCode, isPaid, isCancelled, orderCode]);

  const eventPaymentMode = registration?.event?.registrationPaymentMode;
  const isBalanceDueMode = eventPaymentMode === 'BALANCE_DUE';
  const eventTitle = registration?.event?.title ?? 'Evento';
  const paymentModeLabel = eventPaymentMode
    ? isBalanceDueMode
      ? 'Saldo a quitar'
      : 'Pagamento único'
      : 'Modo de pagamento indisponível';

  // Pago e restante calculados sem taxa de juros (só pagamentos confirmados vs. preço base)
  const paidSemJuros = useMemo(() => {
    return sortedPayments
      .filter((p) => p.status === 'confirmed')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [sortedPayments]);
  const remainingSemJuros = Math.max(0, (Number(registration?.finalPrice) || 0) - paidSemJuros);

  // Nome do primeiro inscrito
  const nomeInscrito = registration?.attendees?.[0]?.attendeeData?.nome_completo ?? null;

  // Mapa fieldName → label
  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    formFields.forEach((f) => { map[f.fieldName] = f.label; });
    return map;
  }, [formFields]);

  const canPay =
    registration &&
    isBalanceDueMode &&
    !isPaid &&
    !isCancelled &&
    remainingSemJuros > 0;

  const displayPixQrCode = activePixQrCode ?? null;
  const displayPixQrCodeBase64 = activePixQrCodeBase64 ?? null;

  const eventIdForRegistration = registration?.event?.id;
  const optionsForMethod = useMemo(
    () =>
      paymentOptions.filter(
        (option) => option.paymentType === method && option.eventId === eventIdForRegistration
      ),
    [eventIdForRegistration, method, paymentOptions]
  );

  useEffect(() => {
    const selectedId = String(selectedPaymentOptionId || '');
    if (!optionsForMethod.length) {
      if (selectedId) {
        setSelectedPaymentOptionId('');
      }
      return;
    }
    if (!optionsForMethod.some((option) => String(option.id) === selectedId)) {
      setSelectedPaymentOptionId(String(optionsForMethod[0].id));
    }
  }, [optionsForMethod, selectedPaymentOptionId]);

  const selectedPaymentOption = paymentOptions.find(
    (option) => String(option.id) === String(selectedPaymentOptionId)
  );
  const showCreditCardFields =
    method === 'credit_card' && selectedPaymentOption?.paymentType === 'credit_card';
  const maxInstallments = Math.max(1, selectedPaymentOption?.maxInstallments ?? 1);
  const installmentOptions = Array.from({ length: maxInstallments }, (_, index) => index + 1);
  const selectedInstallmentInterest = getInstallmentInterestRule(selectedPaymentOption, installments);
  const interestDescription = formatInstallmentInterest(selectedInstallmentInterest);

  // Métodos disponíveis (para os botões PIX / Cartão)
  const pixAvailable = paymentOptions.some(
    (option) => option.paymentType === 'pix' && option.eventId === eventIdForRegistration
  );
  const cardAvailable = paymentOptions.some(
    (option) => option.paymentType === 'credit_card' && option.eventId === eventIdForRegistration
  );

  // Se o método selecionado deixar de existir, cai para o primeiro disponível
  useEffect(() => {
    if (method === 'pix' && !pixAvailable && cardAvailable) {
      setMethod('credit_card');
    } else if (method === 'credit_card' && !cardAvailable && pixAvailable) {
      setMethod('pix');
    }
  }, [method, pixAvailable, cardAvailable]);

  // Base para calcular o valor da parcela exibido no seletor
  const amountBaseValue = Number((amount || '').replace(',', '.')) || 0;

  // Pré-visualização do cartão
  const cardNumberDisplay = cardData.cardNumber?.trim() || '•••• •••• •••• ••••';
  const cardHolderDisplay = cardData.cardHolder?.trim() || 'NOME COMPLETO';
  const cardExpDisplay = cardData.expirationDate?.trim() || 'MM/AAAA';
  const cardCvvDisplay = cardData.securityCode?.trim() || '•••';

  // No modo "valor integral" mantém o campo sincronizado com o saldo restante
  useEffect(() => {
    if (amountMode === 'integral') {
      setAmount(formatNumberInput(remainingSemJuros));
    }
  }, [amountMode, remainingSemJuros]);

  useEffect(() => {
    if (method === 'credit_card' && installments > maxInstallments) {
      setInstallments(maxInstallments);
    }
  }, [installments, method, maxInstallments]);

  const handleSubmitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registration) return;

    const parsedAmount = Number(amount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Informe um valor válido para pagamento.');
      return;
    }

    if (parsedAmount > remainingSemJuros) {
      toast.error('O valor informado é maior que o saldo restante.');
      return;
    }

    if (!selectedPaymentOptionId) {
      toast.error('Selecione uma opção de pagamento ativa.');
      return;
    }

    const selectedPaymentOption = paymentOptions.find(
      (option) => String(option.id) === String(selectedPaymentOptionId)
    );
    if (!selectedPaymentOption) {
      toast.error('Opção de pagamento inválida.');
      return;
    }

    if (method === 'credit_card') {
      const sanitizedCardNumber = removeNonDigits(cardData.cardNumber);
      if (!sanitizedCardNumber || !cardData.cardHolder.trim() || !cardData.expirationDate || !cardData.securityCode) {
        toast.error('Preencha todos os dados do cartão.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const feeAmount = method === 'credit_card'
        ? calculateInstallmentInterestAmount(parsedAmount, selectedPaymentOption, installments)
        : 0;
      const totalAmount = Number((parsedAmount + feeAmount).toFixed(2));
      const payload: CreateRegistrationPaymentPayload = {
        amount: parsedAmount,
        feeAmount,
        taxAmount: feeAmount,
        interestAmount: feeAmount,
        totalAmount,
        method,
        paymentOptionId: selectedPaymentOption.id,
      };

      if (method === 'credit_card') {
        payload.paymentData = {
          cardNumber: removeNonDigits(cardData.cardNumber),
          cardHolder: cardData.cardHolder.trim(),
          expirationDate: cardData.expirationDate,
          securityCode: cardData.securityCode,
          installments,
          amount: parsedAmount,
          feeAmount,
          taxAmount: feeAmount,
          interestAmount: feeAmount,
          totalAmount,
        };
      }

      const updated = await criarPagamentoInscricao(registration.id, payload);
      if (method === 'pix') {
        // Extract QR code from POST response before re-fetching (POST has qrCode, GET may not)
        const { pixQrCode, pixQrCodeBase64 } = extractPixQrCodes(updated);
        setActivePixQrCode(pixQrCode);
        setActivePixQrCodeBase64(pixQrCodeBase64);
        setPixSecondsLeft(300);
        // Re-fetch full registration so financial status / attendees stay populated
        if (orderCode) {
          const fresh = await consultarInscricao(orderCode);
          setRegistration(fresh);
        } else {
          setRegistration(updated);
        }
      } else {
        setRegistration(updated);
      }
      setAmount('');
      if (method === 'credit_card') {
        setCardData(initialCardData);
        setInstallments(1);
      }
      toast.success('Pagamento enviado com sucesso.');
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      toast.error(getFriendlyPaymentError(error, 'Não foi possível registrar o pagamento.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!orderCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Inscrição não encontrada</CardTitle>
            <CardDescription>Não foi possível identificar a inscrição.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/eventos')} className="w-full">
              Voltar para eventos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Erro ao carregar inscrição</CardTitle>
            <CardDescription>Tente novamente mais tarde.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={carregarInscricao} className="w-full">
              Recarregar
            </Button>
            <Button onClick={() => setLocation('/eventos')} variant="outline" className="w-full">
              Voltar para eventos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="container max-w-4xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => setLocation('/eventos')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para eventos
        </button>

        {/* Header da inscrição */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Minha Inscrição</h1>
              <p className="text-sm text-slate-500 mt-1">{eventTitle}</p>
              {nomeInscrito && (
                <p className="text-sm font-medium text-slate-700 mt-1">{nomeInscrito}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={paymentStatusVariant[registration.paymentStatus]} className="text-xs">
                {paymentStatusLabel[registration.paymentStatus]}
              </Badge>
              <span className="text-xs text-slate-400">{paymentModeLabel}</span>
            </div>
          </div>
        </div>

        {isCancelled && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
            <p className="font-semibold text-rose-800">Inscrição cancelada</p>
            <p className="text-sm text-rose-700 mt-1">
              Esta inscrição foi cancelada e não pode ser atualizada ou reaberta. Qualquer parcela
              ou QR Code gerado anteriormente não deve ser utilizado.
            </p>
          </div>
        )}

        {/* Status financeiro */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Status financeiro</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {formatCurrency(registration.finalPrice)}
              </p>
            </div>
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-xs text-green-600 uppercase tracking-wide">Pago</p>
              <p className="text-xl font-bold text-green-700 mt-1">
                {formatCurrency(paidSemJuros)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs text-amber-600 uppercase tracking-wide">Restante</p>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {formatCurrency(remainingSemJuros)}
              </p>
            </div>
          </div>
        </div>

        {registration.attendees && registration.attendees.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Dados dos Inscritos</h2>
            <p className="text-xs text-slate-400 mb-5">Verifique o nome e os dados cadastrados.</p>
            <div className="space-y-6">
              {registration.attendees.map((attendee, index) => {
                const entries = Object.entries(attendee.attendeeData);
                return (
                  <div key={attendee.id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        Inscrito {attendee.attendeeNumber || index + 1}
                      </span>
                      {attendee.batch?.name && (
                        <Badge variant="secondary" className="text-xs">
                          {attendee.batch.name}
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {entries.map(([field, value]) => (
                        <div key={`${attendee.id}-${field}`} className="text-sm space-y-0.5">
                          <p className="text-xs text-slate-400 uppercase tracking-wide">
                            {fieldLabelMap[field] ?? formatFieldName(field)}
                          </p>
                          <p className="font-medium text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                    {index < registration.attendees!.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {displayPixQrCodeBase64 && !isPaid && !isCancelled && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center gap-5">
            <div className="w-full flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-slate-400" />
                PIX pendente
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>
                  Expira em {Math.floor(pixSecondsLeft / 60)}:{String(pixSecondsLeft % 60).padStart(2, '0')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshPixQrCode}
                  disabled={refreshingPix}
                  className="h-7 gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshingPix ? 'animate-spin' : ''}`} />
                  {refreshingPix ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <img
                src={`data:image/png;base64,${displayPixQrCodeBase64}`}
                alt="QR Code PIX"
                className="w-52 h-52"
              />
            </div>
            <p className="text-xs text-slate-400 text-center">
              Após o pagamento, esta tela será atualizada automaticamente.
            </p>
            {displayPixQrCode && (
              <div className="w-full space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-wide">Código PIX</Label>
                <div className="flex gap-2">
                  <Input value={displayPixQrCode} readOnly className="flex-1 text-xs font-mono" />
                  <Button size="sm" variant="outline" onClick={handleCopyPixCode} disabled={copyingPixCode}>
                    {copyingPixCode ? 'Copiando...' : 'Copiar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isPaid && registration.checkinQrCode && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center gap-4">
            <div className="w-full flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h2 className="text-sm font-semibold text-slate-700">Inscrição quitada</h2>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <img
                src={`data:image/png;base64,${registration.checkinQrCode}`}
                alt="QR Code de check-in"
                className="w-52 h-52"
              />
            </div>
            <p className="text-sm text-green-700 font-medium">Apresente o QR Code no check-in.</p>
          </div>
        )}

        {canPay && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-slate-400" />
                Forma de pagamento
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Escolha como pagar e o valor. O saldo será atualizado automaticamente.
              </p>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-5">
              {/* Método de pagamento — botões PIX / Cartão */}
              {loadingPaymentOptions ? (
                <p className="text-sm text-slate-400">Carregando formas de pagamento...</p>
              ) : !pixAvailable && !cardAvailable ? (
                <p className="text-sm text-destructive">Nenhuma forma de pagamento disponível.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'pix' as const, label: 'PIX', Icon: QrCode, available: pixAvailable },
                      { key: 'credit_card' as const, label: 'Cartão', Icon: CreditCard, available: cardAvailable },
                    ]
                      .filter((m) => m.available)
                      .map(({ key, label, Icon }) => {
                        const isSelected = method === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setMethod(key)}
                            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3.5 text-sm font-medium transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                            {isSelected && <Check className="h-3.5 w-3.5 ml-1" />}
                          </button>
                        );
                      })}
                  </div>

                  {/* Seletor de opção ativa (só quando há mais de uma para o método) */}
                  {optionsForMethod.length > 1 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-option" className="text-sm font-medium text-slate-700">
                        Opção ativa
                      </Label>
                      <Select
                        value={selectedPaymentOptionId}
                        onValueChange={(value) => setSelectedPaymentOptionId(value)}
                      >
                        <SelectTrigger id="payment-option" className="w-full bg-white border-slate-400 focus:border-primary">
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          {optionsForMethod.map((option) => {
                            const optionLabel = option.paymentType === 'pix' ? 'PIX' : 'Cartão';
                            const hasInstallmentRates = Array.isArray(option.installmentInterestRates)
                              ? option.installmentInterestRates.length > 0
                              : Boolean(
                                  option.installmentInterestRates &&
                                    Object.keys(option.installmentInterestRates).length > 0
                                );
                            const interestText = hasInstallmentRates
                              ? 'juros por parcela'
                              : formatInstallmentInterest(getInstallmentInterestRule(option, 2));
                            return (
                              <SelectItem key={option.id} value={String(option.id)}>
                                {optionLabel} — {interestText}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!optionsForMethod.length && (
                    <p className="text-xs text-destructive">
                      Nenhuma forma ativa encontrada para {method === 'pix' ? 'PIX' : 'Cartão'}.
                    </p>
                  )}

                  {/* Quanto pagar agora — valor integral ou outro valor */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quanto pagar agora?</p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setAmountMode('integral')}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                          amountMode === 'integral' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-slate-800">Valor integral</p>
                          <p className="text-xs text-slate-500 mt-0.5">Quite todo o saldo restante</p>
                        </div>
                        <span className="ml-4 shrink-0 font-bold text-primary">{formatCurrency(remainingSemJuros)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAmountMode('outro');
                          setAmount('');
                        }}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                          amountMode === 'outro' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <p className="font-medium text-slate-800">Outro valor</p>
                      </button>
                      {amountMode === 'outro' && (
                        <div className="pt-1">
                          <Input
                            id="payment-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={remainingSemJuros}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder={`Máx. ${formatCurrency(remainingSemJuros)}`}
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Saldo restante: <span className="font-semibold">{formatCurrency(remainingSemJuros)}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parcelas (cartão) */}
                  {showCreditCardFields && selectedPaymentOption && maxInstallments > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">Parcelas</Label>
                      <Select value={installments.toString()} onValueChange={(value) => setInstallments(Number(value))}>
                        <SelectTrigger className="w-full bg-white border-slate-400 focus:border-primary">
                          <SelectValue placeholder="Quantidade de parcelas" />
                        </SelectTrigger>
                        <SelectContent>
                          {installmentOptions.map((option) => {
                            const feeAmount = calculateInstallmentInterestAmount(amountBaseValue, selectedPaymentOption, option);
                            const totalWithFee = amountBaseValue + feeAmount;
                            const perInstallment = option > 0 ? totalWithFee / option : totalWithFee;
                            const semTaxas = option === 1 || feeAmount <= 0;
                            return (
                              <SelectItem key={option} value={option.toString()}>
                                {option}x de {formatCurrency(perInstallment)}
                                {semTaxas
                                  ? ' sem taxas'
                                  : ` (${formatInstallmentInterest(getInstallmentInterestRule(selectedPaymentOption, option))})`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Taxas do plano: {interestDescription}</p>
                    </div>
                  )}

                  {/* Dados do cartão */}
                  {showCreditCardFields && selectedPaymentOption && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-700 pt-2">Dados do cartão</h3>
                      {/* Preview do cartão */}
                      <div className="max-w-[260px] mx-auto">
                        <div className="relative aspect-[1.586] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white shadow-md">
                          <div className="absolute right-4 top-4 h-8 w-12 rounded-md border border-white/15 bg-white/10" />
                          <div className="flex items-center justify-between">
                            <div className="h-6 w-9 rounded bg-gradient-to-br from-amber-300/90 to-amber-500/90 shadow-inner" />
                            <div className="text-[9px] uppercase tracking-widest text-white/50">Cartão</div>
                          </div>
                          <div className="mt-4 text-base font-semibold tracking-[0.18em]">{cardNumberDisplay}</div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[8px] tracking-widest text-white/40 uppercase">Titular</div>
                              <div className="mt-0.5 text-[11px] text-white font-medium truncate">{cardHolderDisplay}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <div>
                                <div className="text-[8px] tracking-widest text-white/40 uppercase">Val.</div>
                                <div className="mt-0.5 text-[11px] text-white font-medium">{cardExpDisplay}</div>
                              </div>
                              <div>
                                <div className="text-[8px] tracking-widest text-white/40 uppercase">CVV</div>
                                <div className="mt-0.5 text-[11px] text-white font-medium">{cardCvvDisplay}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Inputs */}
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-slate-700">Número do cartão</Label>
                          <Input
                            className="mt-1.5"
                            placeholder="0000 0000 0000 0000"
                            value={cardData.cardNumber}
                            onChange={(event) => {
                              const masked = maskCreditCard(event.target.value);
                              setCardData((prev) => ({ ...prev, cardNumber: masked }));
                            }}
                            maxLength={19}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-slate-700">Nome no cartão</Label>
                          <Input
                            className="mt-1.5"
                            placeholder="NOME COMPLETO"
                            value={cardData.cardHolder}
                            onChange={(event) =>
                              setCardData((prev) => ({ ...prev, cardHolder: event.target.value.toUpperCase() }))
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-medium text-slate-700">Validade</Label>
                            <Input
                              className="mt-1.5"
                              placeholder="MM/AAAA"
                              value={cardData.expirationDate}
                              onChange={(event) => {
                                const masked = maskCardExpiry(event.target.value);
                                setCardData((prev) => ({ ...prev, expirationDate: masked }));
                              }}
                              maxLength={7}
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-slate-700">CVV</Label>
                            <Input
                              className="mt-1.5"
                              placeholder="123"
                              type="password"
                              value={cardData.securityCode}
                              onChange={(event) => {
                                const masked = maskCVV(event.target.value);
                                setCardData((prev) => ({ ...prev, securityCode: masked }));
                              }}
                              maxLength={4}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PIX info — igual ao primeiro pagamento */}
                  {method === 'pix' && (
                    <div className="space-y-2">
                      <div className="flex gap-3 rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-sm">
                        <QrCode className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">Aprovação imediata</p>
                          <p className="text-xs text-blue-600 mt-0.5">O pagamento com PIX leva pouco tempo para ser processado.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 rounded-xl bg-green-50 border border-green-100 p-3.5 text-sm">
                        <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-800">Finalize com facilidade</p>
                          <p className="text-xs text-green-600 mt-0.5">
                            Após gerar o pagamento, o QR Code será exibido abaixo. Escaneie ou cole o código no seu app bancário.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ATENÇÃO */}
                  <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠</span>
                    <div>
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Atenção</p>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Sua vaga no evento só será confirmada após a realização do pagamento. O não pagamento implicará no
                        cancelamento automático da inscrição.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || !optionsForMethod.length || !selectedPaymentOptionId}
                    className="w-full"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processando...
                      </span>
                    ) : (
                      'Pagar agora'
                    )}
                  </Button>
                </>
              )}
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Histórico de pagamentos</h2>
          <p className="text-xs text-slate-400 mb-5">
            {sortedPayments.length === 0
              ? 'Nenhum pagamento registrado até o momento.'
              : 'Confira os pagamentos já realizados.'}
          </p>
          <div className="space-y-4">
            {sortedPayments.length === 0 ? (
              <p className="text-sm text-slate-400">Sem pagamentos registrados.</p>
            ) : (
              sortedPayments.map((payment, index) => (
                <div key={payment.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(payment.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{methodLabel[payment.method]}</Badge>
                      <Badge variant={channelBadgeVariant[payment.channel]}>
                        {channelLabel[payment.channel]}
                      </Badge>
                      <Badge variant={statusBadgeVariant[payment.status]}>
                        {statusLabel[payment.status]}
                      </Badge>
                    </div>
                  </div>
                  {payment.notes && (
                    <p className="text-sm text-slate-500">{payment.notes}</p>
                  )}
                  {index < sortedPayments.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
