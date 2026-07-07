import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Calendar, MapPin, Tag, Loader2, ArrowLeft, CreditCard, QrCode, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import {
  buscarEventoPublico,
  listarLotesPublicos,
  listarCamposFormulario,
  validarCupom,
  processarInscricao,
  buscarFormasPagamento,
  consultarInscricao,
  type Event,
  type EventBatch,
  type FormField,
  type PaymentOption,
  type RegistrationResponse,
} from '@/lib/eventsApi';
import { maskCPForCNPJ, maskPhone, validateCPForCNPJ, validateEmail, removeNonDigits, maskCreditCard, maskCardExpiry, maskCVV } from '@/lib/masks';
import { isBatchActiveNow } from '@/lib/eventUtils';
import {
  applyInstallmentInterest,
  calculateInstallmentInterestAmount,
  formatInstallmentInterest,
  getInstallmentInterestRule,
} from '@/lib/installmentInterest';
import { getCieloDeniedMessage } from '@/lib/paymentDenialReason';
import { extractImagePalette, type ImagePalette } from '@/lib/imagePalette';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getMessageFromPayload = (payload: unknown): string | undefined => {
  if (payload === null || payload === undefined) return undefined;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);

  if (Array.isArray(payload) && payload.length > 0) {
    return getMessageFromPayload(payload[0]);
  }

  if (isRecord(payload)) {
    if ('Message' in payload && payload.Message) {
      return getMessageFromPayload(payload.Message);
    }
    if ('message' in payload && payload.message) {
      return getMessageFromPayload(payload.message);
    }
    if ('error' in payload && payload.error) {
      return getMessageFromPayload(payload.error);
    }
    if ('payload' in payload && payload.payload) {
      return getMessageFromPayload(payload.payload);
    }
    if ('details' in payload && payload.details) {
      return getMessageFromPayload(payload.details);
    }
    if ('errors' in payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
      return getMessageFromPayload(payload.errors[0]);
    }
  }

  return undefined;
};

const parseCardExpiry = (value: string) => {
  const [monthRaw, yearRaw] = value.split('/');
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  return { month, year };
};

const isCardExpiryValid = (value: string): boolean => {
  if (!/^\d{2}\/\d{4}$/.test(value)) return false;
  const { month, year } = parseCardExpiry(value);
  if (!month || month < 1 || month > 12 || !year || year < 2000) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
};

type DebouncedInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value?: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
  transform?: (value: string) => string;
};

function DebouncedInput({
  value = '',
  onValueChange,
  debounceMs = 250,
  transform,
  onBlur,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const scheduleChange = (nextValue: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onValueChange(nextValue);
      timeoutRef.current = null;
    }, debounceMs);
  };

  const flushChange = (nextValue: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onValueChange(nextValue);
  };

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => {
        const nextValue = transform ? transform(e.target.value) : e.target.value;
        setLocalValue(nextValue);
        scheduleChange(nextValue);
      }}
      onBlur={(e) => {
        flushChange(localValue);
        onBlur?.(e);
      }}
    />
  );
}

type DebouncedTextareaProps = Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'> & {
  value?: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
};

function DebouncedTextarea({
  value = '',
  onValueChange,
  debounceMs = 250,
  onBlur,
  ...props
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const scheduleChange = (nextValue: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onValueChange(nextValue);
      timeoutRef.current = null;
    }, debounceMs);
  };

  const flushChange = (nextValue: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onValueChange(nextValue);
  };

  return (
    <Textarea
      {...props}
      value={localValue}
      onChange={(e) => {
        const nextValue = e.target.value;
        setLocalValue(nextValue);
        scheduleChange(nextValue);
      }}
      onBlur={(e) => {
        flushChange(localValue);
        onBlur?.(e);
      }}
    />
  );
}

export default function EventDetails() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/eventos/:id');
  const eventId = (params?.id ?? '').trim();

  const [evento, setEvento] = useState<Event | null>(null);
  const [lotes, setLotes] = useState<EventBatch[]>([]);
  const [campos, setCampos] = useState<FormField[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<PaymentOption[]>([]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estado do formulário
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomValido, setCupomValido] = useState<any>(null);
  const [cupomFormasPermitidas, setCupomFormasPermitidas] = useState<string[] | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [dadosComprador, setDadosComprador] = useState<Record<string, any>>({});
  const [inscritos, setInscritos] = useState<Array<{
    dados: Record<string, any>;
    salvo: boolean;
    id: string;
    batchId: string | null;  // Lote específico do inscrito
  }>>([{ dados: {}, salvo: false, id: '1', batchId: null }]);
  const [inscritoAbertoId, setInscritoAbertoId] = useState<string>('1');
  const [formaPagamento, setFormaPagamento] = useState<string>(''); // ID da forma de pagamento
  const [parcelas, setParcelas] = useState(1);
  const [modoSinal, setModoSinal] = useState<'sinal' | 'total' | 'outro'>('sinal');
  const [valorOutro, setValorOutro] = useState('');
  const [dadosPagamento, setDadosPagamento] = useState({
    cardNumber: '',
    cardHolder: '',
    expirationDate: '',
    securityCode: '',
  });
  const lotesAtivosNoRange = useMemo(
    () => lotes.filter((lote) => isBatchActiveNow(lote)),
    [lotes]
  );
  const lotesById = useMemo(() => {
    const map = new Map<string, EventBatch>();
    for (const lote of lotes) {
      map.set(lote.id, lote);
    }
    return map;
  }, [lotes]);
  const findPaymentOption = (value?: string) =>
    formasPagamento.find((forma) => forma.id.toString() === value);

  const hasLotAvailable = lotesAtivosNoRange.length > 0;
  const paymentUnavailable = !hasLotAvailable || formasPagamento.length === 0;
  const [cardDeniedModalOpen, setCardDeniedModalOpen] = useState(false);
  const [cardDeniedMessage, setCardDeniedMessage] = useState('');
  const [palette, setPalette] = useState<ImagePalette | null>(null);
  const [view, setView] = useState<'detail' | 'checkout'>('detail');
  const [step, setStep] = useState<1 | 2>(1);
  const [cupomAberto, setCupomAberto] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const PAYMENT_STATUS_MESSAGES: Record<string, string> = {
    Authorized: 'Transação autorizada pelo emissor. Aguardar confirmação final.',
    Paid: 'Pagamento confirmado pela Cielo.',
    Confirmed: 'Pagamento confirmado.',
    Denied: 'Transação negada pelo emissor.',
    DeniedByCielo: 'Transação negada pela Cielo.',
    Aborted: 'Pagamento abortado.',
    NotFinished: 'Pagamento não foi finalizado.',
    Waiting: 'Pagamento pendente de confirmação.',
    Captured: 'Pagamento capturado com sucesso.',
    Failed: 'Pagamento recusado.',
    Canceled: 'Pagamento cancelado.',
  };

  const showPaymentStatusToast = (status?: string, fallback?: string) => {
    const normalized = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : '';
    const message =
      PAYMENT_STATUS_MESSAGES[status || normalized] ||
      fallback ||
      'Status do pagamento atualizado.';

    const key = (status || normalized).toLowerCase();
    if (['paid', 'confirmed', 'captured'].includes(key)) {
      toast.success(message);
    } else if (['denied', 'deniedbycielo', 'failed', 'canceled', 'aborted'].includes(key)) {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const verificarPagamentoCartao = async (
    orderCode: string,
    payload: RegistrationResponse
  ) => {
    try {
      const registration = await consultarInscricao(orderCode);
      const cardPayment = registration.payments?.find((payment: any) => payment.method === 'credit_card');
      const status = cardPayment?.status || registration.paymentStatus;
      const normalizedStatus = String(status || '').toLowerCase();

      if (['confirmed', 'paid', 'captured'].includes(normalizedStatus)) {
        showPaymentStatusToast(status, registration.message);
        setLocation(`/ticket/${orderCode}`);
        return;
      }

      if (['failed', 'canceled', 'cancelled', 'denied', 'deniedbycielo', 'aborted'].includes(normalizedStatus)) {
        const denialMessageFromReturnCode = getCieloDeniedMessage(registration);
        const backendMessage =
          cardPayment?.notes ||
          denialMessageFromReturnCode ||
          getMessageFromPayload(registration) ||
          payload.message ||
          'Não autorizado a compra pelo cartão de crédito.';
        showPaymentStatusToast(status, backendMessage);
        setCardDeniedMessage(backendMessage);
        setCardDeniedModalOpen(true);
        return;
      }

      toast.info('Pagamento em análise. Acompanhe o status da inscrição.');
      setLocation(`/inscricao/${orderCode}`);
    } catch (error) {
      console.error('Erro ao verificar pagamento do cartão:', error);
      toast.error('Não foi possível validar o status do pagamento.');
    }
  };

  useEffect(() => {
    if (!eventId) {
      setLoadingEvent(false);
      setLoadingDetails(false);
      setLocation('/eventos');
      return;
    }
    carregarDados();
  }, [eventId, setLocation]);

  // Extrai a paleta de cores da imagem do evento para harmonizar a página
  useEffect(() => {
    let active = true;
    if (!evento?.imageUrl) {
      setPalette(null);
      return;
    }
    extractImagePalette(evento.imageUrl).then((p) => {
      if (active) setPalette(p);
    });
    return () => {
      active = false;
    };
  }, [evento?.imageUrl]);

  const adicionarInscrito = () => {
    const limite = evento?.maxPerBuyer || 10;
    if (inscritos.length >= limite) {
      toast.error(`Máximo de ${limite} inscrição(ões) por comprador`);
      return;
    }
    setInscritos(prev => [...prev, { dados: {}, salvo: false, id: Date.now().toString(), batchId: null }]);
  };

  const removerInscrito = (id: string) => {
    if (inscritos.length === 1) {
      toast.error('É necessário pelo menos 1 inscrito');
      return;
    }
    // Usar funcional para garantir estado mais recente e evitar problemas de concorrência no DOM
    setInscritos(prev => prev.filter((i) => i.id !== id));
  };

  const salvarInscrito = (id: string) => {
    const inscrito = inscritos.find((i) => i.id === id);
    if (!inscrito) return;

    // Validar campos obrigatórios
    for (const campo of camposInscrito) {
      if (campo.isRequired && !inscrito.dados[campo.fieldName]) {
        toast.error(`Campo obrigatório: ${campo.label}`);
        return;
      }
    }

    // Marcar como salvo
    setInscritos(prev => prev.map((i) => (i.id === id ? { ...i, salvo: true } : i)));
    toast.success('Inscrito salvo!');
  };

  const atualizarDadosInscrito = (id: string, campo: string, valor: any) => {
    setInscritos(prev =>
      prev.map((i) =>
        i.id === id ? { ...i, dados: { ...i.dados, [campo]: valor }, salvo: false } : i
      )
    );
  };

  useEffect(() => {
    if (!inscritos.length) return;
    const inscritoAbertoExiste = inscritos.some((i) => i.id === inscritoAbertoId);
    if (!inscritoAbertoId || !inscritoAbertoExiste) {
      setInscritoAbertoId(inscritos[0].id);
    }
  }, [inscritos, inscritoAbertoId]);

  const carregarDados = async () => {
    setLoadingEvent(true);
    setLoadingDetails(true);

    // ============================================
    // OTIMIZAÇÃO: CARREGAMENTO PARALELO TOTAL
    // ============================================
    // Executar TODAS as APIs em paralelo ao mesmo tempo
    // ANTES: buscarEventoPublico (13s) → depois Promise.all (1s) = 14s
    // DEPOIS: Promise.all de TUDO = max(13s, 1s, 1s, 1s) = 13s
    // GANHO: ~1-3 segundos
    // ============================================

    const promises = [
      // Promise 1: Buscar evento (13s)
      buscarEventoPublico(eventId)
        .then(data => {
          setEvento(data);
          return data;
        })
        .catch(error => {
          console.error('Erro ao carregar evento:', error);
          toast.error('Erro ao carregar evento');
          throw error;
        }),

      // Promise 2: Buscar lotes (1s)
      listarLotesPublicos(eventId, { skipCache: true })
        .then(data => {
          setLotes(data.filter((l) => l.isActive));
          return data;
        })
        .catch(error => {
          console.error('Erro ao carregar lotes:', error);
          return [];
        }),

      // Promise 3: Buscar campos (1s)
      listarCamposFormulario(eventId)
        .then(data => {
          setCampos(data);
          return data;
        })
        .catch(error => {
          console.error('Erro ao carregar campos:', error);
          return [];
        }),

      // Promise 4: Buscar formas de pagamento (1s)
      buscarFormasPagamento(eventId)
        .then(data => {
          setFormasPagamento(data.filter((f) => f.isActive));
          return data;
        })
        .catch(error => {
          console.error('Erro ao carregar formas de pagamento:', error);
          return [];
        }),
    ];

    try {
      // Aguardar TODAS as promises em paralelo
      // Promise.allSettled garante que todas executem mesmo se alguma falhar
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Erro geral ao carregar dados:', error);
    } finally {
      setLoadingEvent(false);
      setLoadingDetails(false);
    }
  };

  const handleValidarCupom = async () => {
    const codigoLimpo = cupomCodigo.trim();
    if (!codigoLimpo) return;

    const loteParaValidar = inscritos.find((i) => i.batchId)?.batchId;
    if (!loteParaValidar) {
      toast.error('Selecione um lote antes de validar o cupom');
      return;
    }

    try {
      setValidandoCupom(true);
      const attendeesWithBatch = inscritos.filter((inscrito) => Boolean(inscrito.batchId));
      const attendeesDataForValidation = attendeesWithBatch.map((inscrito) => ({
        batchId: inscrito.batchId as string,
        data: inscrito.dados || {},
      }));
      const attendeesPayload = attendeesWithBatch.map((inscrito) => ({
        batchId: inscrito.batchId as string,
      }));
      const resultado = await validarCupom({
        code: codigoLimpo,
        eventId,
        batchId: loteParaValidar,
        quantity: attendeesWithBatch.length,
        attendees: attendeesPayload,
        attendeesData: attendeesDataForValidation,
      });
      if (resultado.valido) {
        setCupomValido(resultado.coupon);
        const permitidas = resultado.allowedPaymentTypes?.length ? resultado.allowedPaymentTypes : null;
        setCupomFormasPermitidas(permitidas);
        if (permitidas && formaPagamento) {
          const formaAtual = formasPagamento.find((f) => f.id.toString() === formaPagamento);
          if (formaAtual && !permitidas.includes(formaAtual.paymentType)) {
            setFormaPagamento('');
          }
        }
        toast.success('Cupom aplicado com sucesso!');
      } else {
        setCupomValido(null);
        setCupomFormasPermitidas(null);
        const resultadoMessage =
          getMessageFromPayload(resultado.message) || 'Cupom inválido';
        toast.error(resultadoMessage);
      }
    } catch (error: unknown) {
      const axiosLikeError = error as {
        response?: { data?: unknown };
        message?: unknown;
      };
      const errorMessage =
        getMessageFromPayload(axiosLikeError.response?.data) ||
        getMessageFromPayload(axiosLikeError.message) ||
        'Erro ao validar cupom';
      setCupomValido(null);
      setCupomFormasPermitidas(null);
      toast.error(errorMessage);
    } finally {
      setValidandoCupom(false);
    }
  };

  const calcularSubtotal = () =>
    inscritos.reduce((sum, inscrito) => {
      if (!inscrito.batchId) return sum;
      const lote = lotesById.get(inscrito.batchId);
      return sum + (lote ? Number(lote.price) : 0);
    }, 0);

  const calcularDesconto = (subtotal: number) => {
    if (!cupomValido) return 0;
    if (cupomValido.discountType === 'percentage') {
      return subtotal * (Number(cupomValido.discountValue) / 100);
    }
    return Number(cupomValido.discountValue);
  };

  const calcularValorTotal = (installments = parcelas) => {
    const subtotal = calcularSubtotal();
    if (subtotal === 0) return 0;

    const totalSemTaxas = subtotal - calcularDesconto(subtotal);
    let total = totalSemTaxas;

    // Em BALANCE_DUE os juros incidem apenas sobre o sinal, não sobre o total do evento.
    // Fora do BALANCE_DUE, aplica juros normalmente sobre o total.
    if (
      formaPagamento &&
      installments > 1 &&
      evento?.registrationPaymentMode !== 'BALANCE_DUE'
    ) {
      const pagamento = findPaymentOption(formaPagamento);
      total = applyInstallmentInterest(totalSemTaxas, pagamento, installments);
    }

    return Math.max(0, total);
  };

  const validarFormulario = () => {
    // Validar que todos os inscritos têm um lote selecionado
    const inscritosSemLote = inscritos.filter((i) => !i.batchId);
    if (inscritosSemLote.length > 0) {
      toast.error(`Selecione um lote para todos os inscritos`);
      return false;
    }

    // Validar campos do comprador
    for (const campo of camposComprador) {
      if (campo.isRequired && !dadosComprador[campo.fieldName]) {
        toast.error(`Campo obrigatório: ${campo.label}`);
        return false;
      }
    }

    // Validar se todos os inscritos foram salvos
    const inscritosNaoSalvos = inscritos.filter((i) => !i.salvo);
    if (inscritosNaoSalvos.length > 0) {
      toast.error(`Existem ${inscritosNaoSalvos.length} inscrito(s) não salvo(s). Salve todos antes de continuar.`);
      return false;
    }

    // Validar forma de pagamento selecionada (somente quando ha valor a pagar)
    if (requiresPayment && !formaPagamento) {
      toast.error('Selecione uma forma de pagamento');
      return false;
    }

    // Validar dados de pagamento apenas para cartao de credito
    const formaSelecionada = findPaymentOption(formaPagamento);
    if (requiresPayment && formaSelecionada?.paymentType === 'credit_card') {
      if (!dadosPagamento.cardNumber || !dadosPagamento.cardHolder || 
          !dadosPagamento.expirationDate || !dadosPagamento.securityCode) {
        toast.error('Preencha todos os dados do cartão');
        return false;
      }

      const cardDigits = removeNonDigits(dadosPagamento.cardNumber || '');
      if (cardDigits.length < 13 || cardDigits.length > 19) {
        toast.error('Número do cartão inválido');
        return false;
      }

      if (!isCardExpiryValid(dadosPagamento.expirationDate || '')) {
        toast.error('Validade do cartão inválida. Use o formato MM/AAAA');
        return false;
      }

      const cvvDigits = removeNonDigits(dadosPagamento.securityCode || '');
      if (cvvDigits.length < 3 || cvvDigits.length > 4) {
        toast.error('CVV inválido');
        return false;
      }
    }

    if (requiresPayment && isBalanceDue) {
      if (!baseDepositoSemJuros || baseDepositoSemJuros <= 0) {
        toast.error('Informe o valor do sinal ou pagamento inicial');
        return false;
      }
      if (minimoSinal > 0 && Math.round(baseDepositoSemJuros * 100) < Math.round(minimoSinal * 100)) {
        toast.error(`O valor do sinal deve ser de pelo menos R$ ${minimoSinal.toFixed(2)}`);
        return false;
      }
      if (baseDepositoSemJuros > totalSemJuros) {
        toast.error('O valor informado nao pode ser maior que o total');
        return false;
      }
      if (modoSinal === 'outro') {
        const val = parseFloat(valorOutro.replace(',', '.')) || 0;
        if (!val || val <= 0) {
          toast.error('Informe um valor valido para o pagamento inicial');
          return false;
        }
      }
    }

    return true;
  };

  const avancarParaPagamento = () => {
    if (!hasLotAvailable) {
      toast.error('Inscrições encerradas para este evento.');
      return;
    }
    if (camposInscrito.length > 0) {
      const inscritosSemLote = inscritos.filter((i) => !i.batchId);
      if (inscritosSemLote.length > 0) {
        toast.error('Selecione um lote para todos os inscritos');
        return;
      }
      const inscritosNaoSalvos = inscritos.filter((i) => !i.salvo);
      if (inscritosNaoSalvos.length > 0) {
        toast.error(`Salve todos os inscritos antes de continuar`);
        return;
      }
    }
    // Os dados do comprador agora são preenchidos na etapa de pagamento;
    // a validação deles ocorre no envio final (validarFormulario).
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const iniciarInscricao = (batchId: string) => {
    const autoSalvo = camposInscrito.length === 0;
    setInscritos([{ dados: {}, salvo: autoSalvo, id: Date.now().toString(), batchId }]);
    setStep(1);
    setView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ensureSelectedBatchesStillAvailable = async () => {
    try {
      const refreshedLotes = await listarLotesPublicos(eventId, { skipCache: true });
      setLotes(refreshedLotes.filter((lote) => lote.isActive));

      for (let index = 0; index < inscritos.length; index++) {
        const inscrito = inscritos[index];
        if (!inscrito.batchId) continue;

        const matchingBatch = refreshedLotes.find((lote) => lote.id === inscrito.batchId);
        if (!matchingBatch || !isBatchActiveNow(matchingBatch)) {
          const loteNome = matchingBatch?.name || 'selecionado';
          toast.error(
            `O lote ${loteNome} do Inscrito ${index + 1} não está mais disponível. Escolha outro lote.`
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar lotes disponíveis antes da compra:', error);
      toast.error('Não foi possível validar a disponibilidade dos lotes. Tente novamente em instantes.');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasLotAvailable) {
      toast.error('Inscrições encerradas para este evento.');
      return;
    }

    if (!validarFormulario()) return;
    if (!(await ensureSelectedBatchesStillAvailable())) return;

    try {
      setSubmitting(true);
      const pagamentoBase = isBalanceDue ? baseDepositoSemJuros : totalSemJuros;
      const taxaPagamento = selectedPaymentOption?.paymentType === 'credit_card'
        ? calculateInstallmentInterestAmount(pagamentoBase, selectedPaymentOption, parcelas)
        : 0;
      const pagamentoTotal = Number((pagamentoBase + taxaPagamento).toFixed(2));
      const resultado = await processarInscricao({
        eventId,
        quantity: inscritos.length,
        buyerData: dadosComprador,
        attendeesData: inscritos.map((i) => ({
          batchId: i.batchId!,
          data: i.dados
        })),
        couponCode: cupomValido ? cupomCodigo.trim() : undefined,
        paymentOptionId: requiresPayment ? formaPagamento : undefined,
        paymentData: requiresPayment
          ? {
              ...dadosPagamento,
              installments: parcelas,
              amount: pagamentoBase,
              feeAmount: taxaPagamento,
              taxAmount: taxaPagamento,
              interestAmount: taxaPagamento,
              totalAmount: pagamentoTotal,
            }
          : undefined,
      });

    const isSuccessful = Boolean(
      (resultado as RegistrationResponse & { sucesso?: boolean }).success ||
      (resultado as RegistrationResponse & { sucesso?: boolean }).sucesso
    );

    if (isSuccessful) {
      // Inscrição duplicada: redirecionar para o PIX pendente já existente
      if ((resultado as RegistrationResponse & { duplicata?: boolean }).duplicata) {
        toast.info('Você já tem uma inscrição pendente para este evento.', {
          description: 'Redirecionando para o pagamento PIX existente...',
        });
        const pixCode = resultado.pagamento?.qrCodeString || '';
        const qrCode = resultado.pagamento?.qrCodeBase64 || '';
        setLocation(
          `/pix-confirmacao?orderCode=${resultado.orderCode}&pixCode=${encodeURIComponent(pixCode)}&qrCode=${encodeURIComponent(qrCode)}`
        );
        return;
      }

      if (!requiresPayment) {
        setLocation(`/ticket/${resultado.orderCode}`);
        return;
      }
      const formaPagamentoSelecionada = findPaymentOption(formaPagamento);
      console.log('=== DEBUG REDIRECIONAMENTO ==>');
      console.log('formaPagamento (ID selecionado):', formaPagamento);
      console.log('formasPagamento (array completo):', formasPagamento);
      console.log('formaPagamentoSelecionada:', formaPagamentoSelecionada);
      console.log('paymentType:', formaPagamentoSelecionada?.paymentType);
      console.log('resultado.pagamento:', resultado.pagamento);
      console.log('qrCodeString:', resultado.pagamento?.qrCodeString);
      console.log('qrCodeBase64:', resultado.pagamento?.qrCodeBase64);

      if (formaPagamentoSelecionada?.paymentType === 'pix') {
        console.log('ENTRANDO NO IF DO PIX');
        const pixCode = resultado.pagamento?.qrCodeString || '';
        const qrCode = resultado.pagamento?.qrCodeBase64 || '';
        console.log('Redirecionando para:', `/pix-confirmacao?orderCode=${resultado.orderCode}`);
        setLocation(
          `/pix-confirmacao?orderCode=${resultado.orderCode}&pixCode=${encodeURIComponent(
            pixCode
          )}&qrCode=${encodeURIComponent(qrCode)}`
        );
        toast.info('Aguardando confirmação do PIX...');
        setTimeout(async () => {
          try {
            const registration = await consultarInscricao(resultado.orderCode);
            const status = registration.paymentStatus;
            if (status === 'confirmed' || status === 'paid') {
              setLocation(`/ticket/${resultado.orderCode}`);
            } else {
              setLocation(`/inscricao/${resultado.orderCode}`);
            }
          } catch (error) {
            console.error('Erro ao verificar pagamento do PIX:', error);
            setLocation(`/inscricao/${resultado.orderCode}`);
          }
        }, 5000);
      } else {
        console.log('ENTRANDO NO ELSE (CARTÃO)');
        await verificarPagamentoCartao(resultado.orderCode, resultado);
      }
    } else {
      const resultadoMessage =
        getMessageFromPayload(resultado) ||
        getMessageFromPayload((resultado as { message?: unknown }).message) ||
        'Não foi possível concluir a inscrição.';
      toast.error(resultadoMessage);
    }
  } catch (error: unknown) {
      console.error('Erro ao processar inscrição:', error);
      const axiosLikeError = error as {
        response?: { data?: unknown };
        message?: unknown;
      };
      const errorMessage =
        getMessageFromPayload(axiosLikeError.response?.data) ||
        getMessageFromPayload(axiosLikeError.message) ||
        'Erro ao processar inscrição';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const isCpfField = (campo: FormField) =>
    campo.fieldType === 'cpf' || campo.fieldName.toLowerCase().includes('cpf');
  const isWhatsAppField = (campo: FormField) => {
    const fieldName = campo.fieldName.toLowerCase();
    const label = (campo.label || '').toLowerCase();
    return (
      campo.fieldType === 'phone' ||
      fieldName.includes('whatsapp') ||
      fieldName.includes('telefone') ||
      label.includes('whatsapp')
    );
  };
  const renderCampo = (
    campo: FormField,
    valor: any,
    onChange: (value: any) => void,
    inputId?: string
  ) => {
    // Borda mais escura + fundo branco + largura total para os campos ficarem nítidos
    const fieldClass = 'w-full bg-white border-slate-400 focus-visible:border-primary';
    const commonProps = {
      id: inputId || campo.fieldName,
      placeholder: campo.placeholder,
      required: campo.isRequired,
      className: fieldClass,
    };

    switch (campo.fieldType) {
      case 'text':
        return (
          <DebouncedInput
            {...commonProps}
            type="text"
            value={valor || ''}
            onValueChange={onChange}
            transform={(nextValue) => {
              if (isCpfField(campo)) return maskCPForCNPJ(nextValue);
              if (isWhatsAppField(campo)) return maskPhone(nextValue);
              return nextValue;
            }}
            maxLength={isCpfField(campo) ? 18 : isWhatsAppField(campo) ? 15 : undefined}
          />
        );
      
      case 'email':
        return (
          <DebouncedInput 
            {...commonProps} 
            type="email" 
            value={valor || ''} 
            onValueChange={onChange}
            onBlur={(e) => {
              if (e.target.value && !validateEmail(e.target.value)) {
                toast.error('Email inválido');
              }
            }}
          />
        );
      
      case 'phone':
        return (
          <DebouncedInput 
            {...commonProps} 
            type="tel" 
            value={valor || ''} 
            onValueChange={onChange}
            transform={maskPhone}
            maxLength={15}
          />
        );
      
      case 'cpf':
        return (
          <DebouncedInput 
            {...commonProps} 
            type="text" 
            value={valor || ''} 
            onValueChange={onChange}
            transform={maskCPForCNPJ}
            onBlur={(e) => {
              const digits = removeNonDigits(e.target.value);
              if (digits && !validateCPForCNPJ(e.target.value)) {
                toast.error(digits.length === 11 ? 'CPF inválido' : 'CNPJ inválido');
              }
            }}
            placeholder="CPF ou CNPJ"
            maxLength={18}
          />
        );
      
      case 'number':
        return <Input {...commonProps} type="number" value={valor || ''} onChange={(e) => onChange(e.target.value)} />;
      
      case 'date':
        return <Input {...commonProps} type="date" value={valor || ''} onChange={(e) => onChange(e.target.value)} />;
      
      case 'textarea':
        return <DebouncedTextarea {...commonProps} value={valor || ''} onValueChange={onChange} />;
      
      case 'select':
        return (
          <Select value={valor || ''} onValueChange={onChange}>
            <SelectTrigger className="w-full bg-white border-slate-400 focus:border-primary">
              <SelectValue placeholder={campo.placeholder || 'Selecione...'} />
            </SelectTrigger>
            <SelectContent>
              {campo.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'radio':
        return (
          <RadioGroup value={valor || ''} onValueChange={onChange}>
            {campo.options?.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`${campo.fieldName}-${opt}`} className="size-5 bg-white border-slate-400" />
                <Label htmlFor={`${campo.fieldName}-${opt}`} className="cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {campo.options?.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  id={`${campo.fieldName}-${opt}`}
                  className="size-5 bg-white border-slate-400"
                  checked={Array.isArray(valor) && valor.includes(opt)}
                  onCheckedChange={(checked) => {
                    const newValue = Array.isArray(valor) ? [...valor] : [];
                    if (checked) {
                      newValue.push(opt);
                    } else {
                      const index = newValue.indexOf(opt);
                      if (index > -1) newValue.splice(index, 1);
                    }
                    onChange(newValue);
                  }}
                />
                <Label htmlFor={`${campo.fieldName}-${opt}`}>{opt}</Label>
              </div>
            ))}
          </div>
        );
      
      default:
        return <Input {...commonProps} value={valor || ''} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const camposComprador = useMemo(
    () => campos.filter((c) => c.section === 'buyer').sort((a, b) => a.orderIndex - b.orderIndex),
    [campos]
  );
  const camposInscrito = useMemo(
    () => campos.filter((c) => c.section === 'attendee').sort((a, b) => a.orderIndex - b.orderIndex),
    [campos]
  );
  const hasLoteSelecionado = inscritos.some((i) => Boolean(i.batchId));
  const cupomDigitado = cupomCodigo.trim();
  const subtotal = calcularSubtotal();
  const desconto = calcularDesconto(subtotal);
  const totalComTaxas = calcularValorTotal();
  const taxasAplicados = Math.max(0, totalComTaxas - Math.max(0, subtotal - desconto));
  const selectedPaymentOption = useMemo(
    () => findPaymentOption(formaPagamento),
    [formasPagamento, formaPagamento]
  );
  const requiresPayment = totalComTaxas > 0;
  const accentButtonStyle = (enabled = true) =>
    palette && enabled
      ? { backgroundColor: palette.accent, color: palette.accentText }
      : undefined;
  const paymentUnavailableEffective = !hasLotAvailable || (requiresPayment && formasPagamento.length === 0);
  const isBalanceDue = evento?.registrationPaymentMode === 'BALANCE_DUE';
  const totalSemJuros = Math.max(0, subtotal - desconto);
  const minimoSinal = evento?.depositAmount ?? 0;
  const valorOutroNumero = parseFloat(valorOutro.replace(',', '.')) || 0;

  const baseDepositoSemJuros = isBalanceDue
    ? modoSinal === 'sinal'
      ? Math.min(evento?.depositAmount ?? totalSemJuros, totalSemJuros)
      : modoSinal === 'total'
      ? totalSemJuros
      : Math.min(Math.max(0, valorOutroNumero), totalSemJuros)
    : totalSemJuros;

  const depositoComJuros =
    isBalanceDue && selectedPaymentOption?.paymentType === 'credit_card' && parcelas > 1
      ? applyInstallmentInterest(baseDepositoSemJuros, selectedPaymentOption, parcelas)
      : baseDepositoSemJuros;

  const pagamentoAgora = isBalanceDue ? depositoComJuros : totalComTaxas;
  const saldoEstimado = isBalanceDue ? Math.max(0, totalSemJuros - baseDepositoSemJuros) : 0;
  const sinalAbaixoMinimo =
    isBalanceDue &&
    minimoSinal > 0 &&
    baseDepositoSemJuros > 0 &&
    Math.round(baseDepositoSemJuros * 100) < Math.round(minimoSinal * 100);
  const cardNumberDisplay = dadosPagamento.cardNumber?.trim() || '•••• •••• •••• ••••';
  const cardHolderDisplay = dadosPagamento.cardHolder?.trim() || 'NOME COMPLETO';
  const cardExpDisplay = dadosPagamento.expirationDate?.trim() || 'MM/AAAA';
  const cardCvvDisplay = dadosPagamento.securityCode?.trim() || '•••';


  useEffect(() => {
    if (!formaPagamento || selectedPaymentOption?.paymentType !== 'credit_card') {
      if (parcelas !== 1) {
        setParcelas(1);
      }
      return;
    }

    const limiteParcelas = Math.max(1, selectedPaymentOption.maxInstallments || 1);
    if (parcelas > limiteParcelas) {
      setParcelas(limiteParcelas);
      return;
    }

    if (parcelas < 1) {
      setParcelas(1);
    }
  }, [formaPagamento, selectedPaymentOption, parcelas]);

  if (loadingEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-slate-500">Carregando evento...</p>
        </div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm w-full space-y-4">
          <p className="font-medium text-slate-700">Evento não encontrado</p>
          <Button variant="outline" onClick={() => setLocation('/eventos')} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para eventos
          </Button>
        </div>
      </div>
    );
  }

  // ──── VIEW: DETALHE DO EVENTO ────
  if (view === 'detail') {
    const fmtDataCompleta = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const inicio = new Date(evento.startDate);
    const fim = evento.endDate ? new Date(evento.endDate) : null;
    let dateLabel = fmtDataCompleta(inicio);
    if (fim && !Number.isNaN(fim.getTime()) && inicio.toDateString() !== fim.toDateString()) {
      const mesmoAno = inicio.getFullYear() === fim.getFullYear();
      const mesmoMes = mesmoAno && inicio.getMonth() === fim.getMonth();
      if (mesmoMes) {
        // "17 a 20 de julho de 2026"
        dateLabel = `${String(inicio.getDate()).padStart(2, '0')} a ${fmtDataCompleta(fim)}`;
      } else if (mesmoAno) {
        // "30 de julho a 02 de agosto de 2026"
        const inicioSemAno = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
        dateLabel = `${inicioSemAno} a ${fmtDataCompleta(fim)}`;
      } else {
        dateLabel = `${fmtDataCompleta(inicio)} a ${fmtDataCompleta(fim)}`;
      }
    }
    const maxPerBuyer = evento.maxPerBuyer || 10;
    const totalQty = Object.values(quantities).reduce((s, n) => s + n, 0);
    const totalAmount = lotes.reduce(
      (sum, lote) => sum + (quantities[lote.id] || 0) * Number(lote.price),
      0
    );

    const increment = (batchId: string) => {
      if (totalQty >= maxPerBuyer) return;
      setQuantities((prev) => ({ ...prev, [batchId]: (prev[batchId] || 0) + 1 }));
    };
    const decrement = (batchId: string) => {
      setQuantities((prev) => {
        const cur = prev[batchId] || 0;
        if (cur <= 0) return prev;
        return { ...prev, [batchId]: cur - 1 };
      });
    };
    const iniciarComQuantidades = () => {
      const novos: typeof inscritos = [];
      let id = Date.now();
      for (const lote of lotes) {
        const qty = quantities[lote.id] || 0;
        for (let i = 0; i < qty; i++) {
          novos.push({ dados: {}, salvo: camposInscrito.length === 0, id: String(id++), batchId: lote.id });
        }
      }
      if (novos.length === 0) return;
      setInscritos(novos);
      setStep(1);
      setView('checkout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
      <div className="min-h-screen relative">
        {/* Background fixo — imagem com blur + overlay */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {evento.imageUrl ? (
            <>
              <img
                src={evento.imageUrl}
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

        {/* Topbar */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="container max-w-5xl mx-auto">
            <button
              type="button"
              onClick={() => setLocation('/eventos')}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>
        </div>

        {/* Grid principal */}
        <div className="container max-w-5xl mx-auto px-4 py-10 pb-32">
          <div className="grid lg:grid-cols-[1fr_400px] gap-10 items-start">

            {/* ── ESQUERDA: Informações ── */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                  {evento.title}
                </h1>
                <div className="space-y-2.5 mt-4">
                  {evento.location && (
                    <div className="flex items-center gap-2.5 text-sm text-white/80">
                      <MapPin className="h-4 w-4 text-white/50 shrink-0" />
                      <span>{evento.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm text-white/80">
                    <Calendar className="h-4 w-4 text-white/50 shrink-0" />
                    <span>{dateLabel}</span>
                  </div>
                </div>
              </div>

              {/* Sobre o evento */}
              {evento.description && (
                <div>
                  <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span
                      className="h-3.5 w-1 rounded-full bg-primary"
                      style={palette ? { backgroundColor: palette.accent } : undefined}
                    />
                    Sobre o evento
                  </h2>
                  <div
                    className="text-sm text-white/70 leading-relaxed max-w-xl [&_p]:my-2 [&_strong]:text-white [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 [&_li]:marker:text-white/40 [&_a]:text-primary [&_a]:underline [&_h3]:text-white [&_h3]:font-semibold [&_h3]:mt-3"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(evento.description) }}
                  />
                </div>
              )}

              {/* Localização com mapa */}
              {evento.location && (
                <div>
                  <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span
                      className="h-3.5 w-1 rounded-full bg-primary"
                      style={palette ? { backgroundColor: palette.accent } : undefined}
                    />
                    Localização
                  </h2>
                  <div className="rounded-2xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-md shadow-xl">
                    {/* Cabeçalho com endereço */}
                    <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/10">
                      <MapPin
                        className="h-4 w-4 text-primary shrink-0 mt-0.5"
                        style={palette ? { color: palette.accent } : undefined}
                      />
                      <p className="text-sm text-white/90 leading-snug">{evento.location}</p>
                    </div>
                    {/* Mapa */}
                    <iframe
                      title="Mapa do local do evento"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(evento.location)}&z=15&output=embed`}
                      className="w-full h-64 border-0 block"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    {/* Ação */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-white bg-white/5 hover:bg-white/15 transition-colors border-t border-white/10"
                    >
                      <MapPin className="h-4 w-4" />
                      Como chegar
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* ── DIREITA: Imagem + card Ingressos com contadores ── */}
            <div className="sticky top-20 space-y-4">
              {/* Imagem destaque */}
              {evento.imageUrl && (
                <div
                  className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-2xl"
                  style={palette ? { boxShadow: palette.shadow } : undefined}
                >
                  <img src={evento.imageUrl} alt={evento.title} className="w-full h-full object-cover" />
                  {!hasLotAvailable && (
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-red-400" />
                      Indisponível
                    </div>
                  )}
                </div>
              )}

              {/* Card Ingressos */}
              <div
                className="bg-white rounded-2xl shadow-xl p-5"
                style={palette ? { boxShadow: palette.shadow } : undefined}
              >
                <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                  <span
                    className="h-4 w-1 rounded-full bg-primary"
                    style={palette ? { backgroundColor: palette.accent } : undefined}
                  />
                  Ingressos
                </h3>

                {loadingDetails ? (
                  <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 animate-pulse">
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-32 bg-slate-200 rounded" />
                          <div className="h-4 w-20 bg-slate-200 rounded" />
                        </div>
                        <div className="h-8 w-24 bg-slate-200 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : lotes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum lote disponível</p>
                ) : (
                  <div className="space-y-4">
                    {lotes.map((lote) => {
                      const esgotado = lote.vagasDisponiveis != null && lote.vagasDisponiveis <= 0;
                      const ativo = isBatchActiveNow(lote);
                      const naoComecou = lote.startDate
                        ? new Date(lote.startDate).getTime() > Date.now()
                        : false;
                      const disponivel = ativo && !esgotado;
                      const qty = quantities[lote.id] || 0;

                      return (
                        <div key={lote.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 leading-snug">{lote.name}</p>
                            <p
                              className="text-sm font-bold text-primary mt-0.5"
                              style={palette ? { color: palette.accent } : undefined}
                            >
                              R$ {Number(lote.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {!disponivel && (
                              <p className={`text-xs mt-0.5 ${naoComecou ? 'text-blue-500' : 'text-red-500'}`}>
                                {esgotado ? 'Esgotado' : naoComecou ? 'Em breve' : 'Encerrado'}
                              </p>
                            )}
                          </div>

                          {disponivel ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => decrement(lote.id)}
                                disabled={qty === 0}
                                style={palette ? { backgroundColor: palette.accent, color: palette.accentText } : undefined}
                                className="h-8 w-8 rounded-full bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                              >
                                −
                              </button>
                              <span className="w-7 text-center font-bold text-slate-900 text-sm tabular-nums">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => increment(lote.id)}
                                disabled={totalQty >= maxPerBuyer}
                                style={palette ? { backgroundColor: palette.accent, color: palette.accentText } : undefined}
                                className="h-8 w-8 rounded-full bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className={`text-xs shrink-0 font-medium ${naoComecou ? 'text-blue-500' : 'text-slate-400'}`}>
                              {naoComecou ? 'Em breve' : 'Indisponível'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Total + botão */}
                <div className="border-t border-slate-100 mt-5 pt-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Total Ingresso</span>
                    <span className="text-lg font-bold text-slate-900">
                      R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <Button
                    onClick={iniciarComQuantidades}
                    disabled={totalQty === 0}
                    className="w-full h-11 font-semibold"
                    size="lg"
                    style={accentButtonStyle(totalQty > 0)}
                  >
                    {totalQty === 0 ? 'Selecione os ingressos' : 'Comprar Ingresso'}
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ──── VIEW: CHECKOUT ────
  // Helper: grupos de inscritos por lote
  const gruposPorLote = (() => {
    const g: Record<string, { lote: typeof lotes[0] | undefined; count: number }> = {};
    for (const i of inscritos.filter((i) => i.batchId)) {
      const key = i.batchId!;
      if (!g[key]) g[key] = { lote: lotesById.get(key), count: 0 };
      g[key].count++;
    }
    return Object.entries(g);
  })();

  return (
    <div className="min-h-screen relative">
      {/* Background — imagem estendida com blur + overlay (mesmo modelo da etapa de ingressos) */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {evento.imageUrl ? (
          <>
            <img
              src={evento.imageUrl}
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

      {/* Topbar */}
      <div className="border-b border-white/10 px-4 py-3 sticky top-0 z-20 bg-slate-900/30 backdrop-blur-md">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (step === 2) setStep(1);
              else setView('detail');
            }}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 2 ? 'Voltar para inscrição' : 'Voltar para o evento'}
          </button>
          {/* Stepper inline no topo */}
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-white' : 'text-white/40'}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step > 1 ? 'bg-primary text-white' : step === 1 ? 'bg-primary text-white ring-2 ring-white/30' : 'bg-white/20 text-white/60'}`}>
                {step > 1 ? <Check className="h-3 w-3" /> : '1'}
              </div>
              Inscrição
            </div>
            <div className={`h-px w-6 ${step >= 2 ? 'bg-primary' : 'bg-white/20'}`} />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-white' : 'text-white/40'}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-primary text-white ring-2 ring-white/30' : 'bg-white/20 text-white/60'}`}>
                2
              </div>
              Pagamento
            </div>
          </div>
        </div>
      </div>

      {/* Título do evento */}
      <div className="container max-w-6xl mx-auto px-4 pt-8 pb-2">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-white drop-shadow-sm">
          {evento.title}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-sm text-white/75">
            <Calendar className="h-4 w-4" />
            {new Date(evento.startDate).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          {evento.location && (
            <span className="flex items-center gap-1.5 text-sm text-white/75">
              <MapPin className="h-4 w-4" />
              {evento.location}
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container max-w-6xl mx-auto px-4 py-6 pb-32">
        <form onSubmit={handleSubmit}>

          {/* ══ ETAPA 1: INSCRIÇÃO ══ */}
          {step === 1 && (
            <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
            {/* Esquerda: formulários */}
            <div className="space-y-5">
              {!hasLotAvailable && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                  Inscrições encerradas — nenhum lote ativo dentro do período vigente.
                </div>
              )}

              {/* Inscritos */}
              {camposInscrito.length > 0 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Inscritos</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {inscritos.filter((i) => i.salvo).length}/{inscritos.length} salvo(s)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={adicionarInscrito}
                      disabled={!hasLotAvailable || inscritos.length >= (evento?.maxPerBuyer || 10)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  <Accordion
                    type="single"
                    collapsible
                    className="w-full divide-y divide-slate-100"
                    value={inscritoAbertoId}
                    onValueChange={setInscritoAbertoId}
                  >
                    {inscritos.map((inscrito, index) => (
                      <AccordionItem key={inscrito.id} value={inscrito.id} className="border-0 first:pt-0 py-1">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3 w-full text-left">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${inscrito.salvo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {inscrito.salvo ? <Check className="h-3.5 w-3.5" /> : index + 1}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-sm text-slate-900">Inscrito {index + 1}</span>
                              {inscrito.batchId && (
                                <span className="text-slate-400 text-xs ml-2">
                                  {lotes.find((l) => l.id === inscrito.batchId)?.name}
                                </span>
                              )}
                            </div>
                            <div className="ml-auto mr-2 shrink-0">
                              {inscrito.salvo ? (
                                <span className="text-xs text-green-600 font-medium">Salvo</span>
                              ) : (
                                <span className="text-xs text-amber-600 font-medium">Pendente</span>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2 pb-4">
                            <div>
                              <Label className="text-sm font-medium text-slate-700">
                                Lote <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={inscrito.batchId || ''}
                                onValueChange={(v) =>
                                  setInscritos((prev) =>
                                    prev.map((i) => (i.id === inscrito.id ? { ...i, batchId: v } : i))
                                  )
                                }
                                disabled={!lotesAtivosNoRange.length}
                              >
                                <SelectTrigger className="mt-1.5 w-full bg-white border-slate-400 focus:border-primary">
                                  <SelectValue placeholder="Selecione o lote" />
                                </SelectTrigger>
                                <SelectContent>
                                  {lotesAtivosNoRange.map((lote) => {
                                    const esgotado = lote.vagasDisponiveis != null && lote.vagasDisponiveis <= 0;
                                    return (
                                      <SelectItem key={lote.id} value={lote.id} disabled={esgotado}>
                                        {lote.name} — R$ {Number(lote.price).toFixed(2)}
                                        {esgotado && ' (Esgotado)'}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {!lotesAtivosNoRange.length && (
                                <p className="text-xs text-red-600 mt-1">Nenhum lote ativo.</p>
                              )}
                            </div>
                            <div className="space-y-4">
                              {camposInscrito.map((campo) => (
                                <div key={campo.id}>
                                  <Label htmlFor={`${campo.fieldName}-${inscrito.id}`} className="text-sm font-medium text-slate-700">
                                    {campo.label}
                                    {campo.isRequired && <span className="text-red-500 ml-1">*</span>}
                                  </Label>
                                  <div className="mt-1.5">
                                    {renderCampo(campo, inscrito.dados[campo.fieldName], (value) => atualizarDadosInscrito(inscrito.id, campo.fieldName, value), `${campo.fieldName}-${inscrito.id}`)}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button type="button" size="sm" onClick={() => salvarInscrito(inscrito.id)} disabled={inscrito.salvo} style={accentButtonStyle(!inscrito.salvo)}>
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                Salvar
                              </Button>
                              {inscritos.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removerInscrito(inscrito.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                  <X className="h-3.5 w-3.5 mr-1.5" />
                                  Remover
                                </Button>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

            </div>

            {/* Direita sticky: imagem + card Ingressos resumo */}
            <div className="sticky top-24 space-y-4">
              {/* Imagem do evento */}
              {evento.imageUrl && (
                <div className="rounded-2xl overflow-hidden aspect-[16/9] shadow-xl border border-white/20">
                  <img src={evento.imageUrl} alt={evento.title} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Card Ingressos — resumo dos selecionados */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-5">
                <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                  <span
                    className="h-4 w-1 rounded-full bg-primary"
                    style={palette ? { backgroundColor: palette.accent } : undefined}
                  />
                  Ingressos
                </h3>

                {/* Listagem por lote com quantidade */}
                {(() => {
                  const grupos: Record<string, { lote: typeof lotes[0] | undefined; count: number }> = {};
                  for (const i of inscritos.filter((i) => i.batchId)) {
                    const key = i.batchId!;
                    if (!grupos[key]) grupos[key] = { lote: lotesById.get(key), count: 0 };
                    grupos[key].count++;
                  }
                  return Object.entries(grupos).map(([batchId, { lote, count }]) => (
                    <div key={batchId} className="flex items-center justify-between text-sm py-1.5">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <span className="text-slate-400">•</span>
                        {lote?.name ?? 'Lote'}
                      </span>
                      <span className="text-slate-900 font-medium tabular-nums">
                        {count} × R$ {Number(lote?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ));
                })()}

                <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between items-center font-bold">
                  <span className="text-slate-700 text-sm">Total Ingressos</span>
                  <span className="text-lg text-slate-900">
                    R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full h-11 font-semibold"
                    onClick={avancarParaPagamento}
                    disabled={!hasLotAvailable}
                    style={accentButtonStyle(hasLotAvailable)}
                  >
                    {!hasLotAvailable ? 'Inscrições encerradas' : 'Continuar com Pagamento →'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setView('detail')}
                    className="w-full text-xs text-primary hover:underline py-1 text-center cursor-pointer"
                  >
                    Voltar para selecionar Ingressos
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* ══ ETAPA 2: PAGAMENTO ══ */}
          {step === 2 && (
            <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">

              {/* Esquerda: Dados do comprador + Forma de pagamento */}
              <div className="space-y-5">
                {/* Dados do Comprador */}
                {camposComprador.length > 0 && (
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-6">
                    <h2 className="text-base font-semibold text-slate-900 mb-5">Seus dados</h2>
                    <div className="space-y-4">
                      {camposComprador.map((campo) => (
                        <div key={campo.id}>
                          <Label htmlFor={campo.fieldName} className="text-sm font-medium text-slate-700">
                            {campo.label}
                            {campo.isRequired && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          <div className="mt-1.5">
                            {renderCampo(
                              campo,
                              dadosComprador[campo.fieldName],
                              (value) => setDadosComprador((prev) => ({ ...prev, [campo.fieldName]: value })),
                              campo.fieldName
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {requiresPayment ? (
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-6 space-y-5">
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-slate-400" />
                      Forma de pagamento
                    </h2>

                    {formasPagamento.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhuma forma de pagamento disponível.</p>
                    ) : (
                      <>
                        {/* Tabs de forma de pagamento */}
                        {(() => {
                          const formasFiltradas = cupomFormasPermitidas
                            ? formasPagamento.filter((f) => cupomFormasPermitidas.includes(f.paymentType))
                            : formasPagamento;
                          const LABEL_METODO: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão de Crédito', boleto: 'Boleto' };
                          return (
                            <>
                              {cupomFormasPermitidas && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Este cupom é válido apenas para: {cupomFormasPermitidas.map((t) => LABEL_METODO[t] || t).join(' ou ')}
                                </p>
                              )}
                              <div className={`grid gap-3 ${formasFiltradas.length === 1 ? 'grid-cols-1' : formasFiltradas.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {formasFiltradas.map((forma) => {
                                  const isSelected = formaPagamento === forma.id.toString();
                                  const label =
                                    forma.paymentType === 'credit_card'
                                      ? `Cartão${forma.maxInstallments > 1 ? ` (${forma.maxInstallments}x)` : ''}`
                                      : forma.paymentType === 'pix'
                                      ? 'PIX'
                                      : 'Boleto';
                                  const Icon = forma.paymentType === 'pix' ? QrCode : CreditCard;
                                  return (
                                    <button
                                      key={forma.id}
                                      type="button"
                                      onClick={() => {
                                        setFormaPagamento(forma.id.toString());
                                        if (forma.paymentType !== 'credit_card') setParcelas(1);
                                      }}
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
                            </>
                          );
                        })()}

                        {/* Opções de sinal */}
                        {isBalanceDue && totalSemJuros > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quanto pagar agora?</p>
                            <div className="flex flex-col gap-2">
                              {evento?.depositAmount && evento.depositAmount < totalSemJuros && (
                                <button type="button" onClick={() => setModoSinal('sinal')}
                                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${modoSinal === 'sinal' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                                  <div>
                                    <p className="font-medium text-slate-800">Pagar sinal</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Quite o restante depois</p>
                                  </div>
                                  <span className="ml-4 shrink-0 font-bold text-primary">R$ {evento.depositAmount.toFixed(2)}</span>
                                </button>
                              )}
                              <button type="button" onClick={() => setModoSinal('total')}
                                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${modoSinal === 'total' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                                <div>
                                  <p className="font-medium text-slate-800">Valor total</p>
                                  <p className="text-xs text-slate-500 mt-0.5">Quitar tudo de uma vez</p>
                                </div>
                                <span className="ml-4 shrink-0 font-bold text-primary">R$ {totalSemJuros.toFixed(2)}</span>
                              </button>
                              <button type="button" onClick={() => setModoSinal('outro')}
                                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${modoSinal === 'outro' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                                <p className="font-medium text-slate-800">Outro valor</p>
                              </button>
                              {modoSinal === 'outro' && (
                                <div className="pt-1">
                                  <Input type="number" min={minimoSinal > 0 ? minimoSinal : 0.01} step="0.01" max={totalSemJuros}
                                    value={valorOutro} onChange={(e) => setValorOutro(e.target.value)}
                                    placeholder={`Máx. R$ ${totalSemJuros.toFixed(2)}`}
                                    className={sinalAbaixoMinimo ? 'border-red-400 focus-visible:ring-red-400' : ''} />
                                  {minimoSinal > 0 && <p className="text-xs text-slate-400 mt-1">Mínimo: <span className="font-semibold">R$ {minimoSinal.toFixed(2)}</span></p>}
                                  {sinalAbaixoMinimo && <p className="text-xs text-red-500 mt-1">Valor menor que o mínimo exigido.</p>}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Parcelas */}
                        {formaPagamento && selectedPaymentOption?.paymentType === 'credit_card' && (
                          <div>
                            <Label className="text-sm font-medium text-slate-700">Parcelas</Label>
                            <Select value={parcelas.toString()} onValueChange={(v) => setParcelas(parseInt(v))}>
                              <SelectTrigger className="mt-1.5 w-full bg-white border-slate-400 focus:border-primary">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: selectedPaymentOption?.maxInstallments || 1 }, (_, i) => i + 1).map((p) => {
                                  const baseCalculo = isBalanceDue ? baseDepositoSemJuros : subtotal - desconto;
                                  const totalParcelado = applyInstallmentInterest(baseCalculo, selectedPaymentOption, p);
                                  const valorParcela = totalParcelado / p;
                                  const regraParcela = getInstallmentInterestRule(selectedPaymentOption, p);
                                  const semTaxas = !selectedPaymentOption || regraParcela.interestRate <= 0 || p === 1;
                                  return (
                                    <SelectItem key={p} value={p.toString()}>
                                      {p}x de R$ {valorParcela.toFixed(2)}
                                      {semTaxas ? ' sem taxas' : ` (${formatInstallmentInterest(regraParcela)})`}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Cartão de crédito */}
                        {formaPagamento && selectedPaymentOption?.paymentType === 'credit_card' && (
                          <div className="space-y-4 pt-2 border-t border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-700 pt-2">Dados do cartão</h3>
                            {/* Preview compacto */}
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
                                <Input className="mt-1.5" placeholder="0000 0000 0000 0000" value={dadosPagamento.cardNumber}
                                  onChange={(e) => setDadosPagamento({ ...dadosPagamento, cardNumber: maskCreditCard(e.target.value) })}
                                  maxLength={19} required />
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-slate-700">Nome no cartão</Label>
                                <Input className="mt-1.5" placeholder="NOME COMPLETO" value={dadosPagamento.cardHolder}
                                  onChange={(e) => setDadosPagamento({ ...dadosPagamento, cardHolder: e.target.value.toUpperCase() })}
                                  required />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm font-medium text-slate-700">Validade</Label>
                                  <Input className="mt-1.5" placeholder="MM/AAAA" value={dadosPagamento.expirationDate}
                                    onChange={(e) => setDadosPagamento({ ...dadosPagamento, expirationDate: maskCardExpiry(e.target.value) })}
                                    maxLength={7} required />
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-slate-700">CVV</Label>
                                  <Input className="mt-1.5" placeholder="123" type="password" value={dadosPagamento.securityCode}
                                    onChange={(e) => setDadosPagamento({ ...dadosPagamento, securityCode: maskCVV(e.target.value) })}
                                    maxLength={4} required />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Cupom toggle */}
                        <div className="space-y-3 border-t border-slate-100 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2 cursor-pointer" htmlFor="cupom-toggle">
                              <Tag className="h-4 w-4 text-slate-400" />
                              Cupom
                            </label>
                            <Switch
                              id="cupom-toggle"
                              checked={cupomAberto}
                              onCheckedChange={(v) => {
                                setCupomAberto(v);
                                if (!v) { setCupomValido(null); setCupomFormasPermitidas(null); setCupomCodigo(''); }
                              }}
                            />
                          </div>
                          {cupomAberto && (
                            <div className="flex gap-2">
                              <Input
                                value={cupomCodigo}
                                onChange={(e) => { setCupomCodigo(e.target.value.toUpperCase()); setCupomValido(null); setCupomFormasPermitidas(null); }}
                                placeholder="Código do cupom"
                                className="flex-1 text-sm"
                              />
                              <Button type="button" onClick={handleValidarCupom} disabled={!cupomDigitado || validandoCupom} size="sm" variant="outline">
                                {validandoCupom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
                              </Button>
                            </div>
                          )}
                          {cupomValido && (
                            <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                              <Check className="h-3.5 w-3.5" />
                              Desconto: {cupomValido.discountType === 'percentage' ? `${cupomValido.discountValue}%` : `R$ ${Number(cupomValido.discountValue).toFixed(2)}`}
                            </div>
                          )}
                        </div>

                        {/* PIX info */}
                        {formaPagamento && selectedPaymentOption?.paymentType === 'pix' && (
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
                                <p className="font-medium text-green-800">Finalize sua compra com facilidade</p>
                                <p className="text-xs text-green-600 mt-0.5">Acesse a área PIX no seu app bancário e escaneie o QR Code ou cole o código.</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {formaPagamento && selectedPaymentOption?.paymentType === 'boleto' && (
                          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                            Após finalizar, você receberá o boleto para pagamento.
                          </div>
                        )}

                        {/* ATENÇÃO */}
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠</span>
                          <div>
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Atenção</p>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                              Sua vaga no evento só será confirmada após a realização do pagamento. O não pagamento implicará no cancelamento automático da inscrição.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-6 text-center">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="font-semibold text-slate-900">Inscrição gratuita</p>
                    <p className="text-sm text-slate-500 mt-1">Confirme sua inscrição clicando no botão ao lado.</p>
                  </div>
                )}
              </div>

              {/* Direita sticky: imagem + resumo ao vivo + submit */}
              <div className="sticky top-24 space-y-4">
                {/* Imagem do evento */}
                {evento.imageUrl && (
                  <div className="rounded-2xl overflow-hidden aspect-[16/9] shadow-xl border border-white/20">
                    <img src={evento.imageUrl} alt={evento.title} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Resumo do pedido — atualiza conforme forma de pagamento, taxas e cupom */}
                {inscritos.some((i) => i.batchId) && (
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl p-5">
                    <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                      <span
                        className="h-4 w-1 rounded-full bg-primary"
                        style={palette ? { backgroundColor: palette.accent } : undefined}
                      />
                      Resumo do pedido
                    </h3>

                    {/* Ingressos por lote */}
                    <div className="space-y-1.5">
                      {gruposPorLote.map(([batchId, { lote, count }]) => (
                        <div key={batchId} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 flex items-center gap-1.5">
                            <span className="text-slate-400">•</span>
                            {lote?.name ?? 'Lote'}
                          </span>
                          <span className="text-slate-900 font-medium tabular-nums">
                            {count} × R$ {Number(lote?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 mt-3 pt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="text-slate-900 tabular-nums">R$ {subtotal.toFixed(2)}</span>
                      </div>
                      {cupomValido && desconto > 0 && (
                        <div className="flex justify-between">
                          <span className="text-green-700 flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" />Cupom
                          </span>
                          <span className="text-green-700 tabular-nums">− R$ {Math.min(desconto, subtotal).toFixed(2)}</span>
                        </div>
                      )}
                      {isBalanceDue && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">{modoSinal === 'total' ? 'Pagamento' : 'Sinal agora'}</span>
                          <span className="text-slate-900 tabular-nums">R$ {baseDepositoSemJuros.toFixed(2)}</span>
                        </div>
                      )}
                      {(() => {
                        const taxa = isBalanceDue ? depositoComJuros - baseDepositoSemJuros : taxasAplicados;
                        return taxa > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-orange-600">Taxa{parcelas > 1 ? ` (${parcelas}x)` : ''}</span>
                            <span className="text-orange-600 tabular-nums">+ R$ {taxa.toFixed(2)}</span>
                          </div>
                        ) : null;
                      })()}
                      {isBalanceDue && saldoEstimado > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Saldo restante</span>
                          <span className="text-slate-400 tabular-nums">R$ {saldoEstimado.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
                      <span className="font-bold text-slate-900">{isBalanceDue ? 'Pagar agora' : 'Total a pagar'}</span>
                      <span className="text-xl font-bold text-primary tabular-nums">R$ {pagamentoAgora.toFixed(2)}</span>
                    </div>

                    {selectedPaymentOption?.paymentType && (
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        via {selectedPaymentOption.paymentType === 'pix'
                          ? 'PIX'
                          : selectedPaymentOption.paymentType === 'credit_card'
                          ? `Cartão${parcelas > 1 ? ` em ${parcelas}x` : ''}`
                          : 'Boleto'}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base font-semibold"
                  disabled={submitting || paymentUnavailableEffective}
                  style={accentButtonStyle(!submitting && !paymentUnavailableEffective)}
                >
                  {paymentUnavailableEffective ? (
                    !hasLotAvailable ? 'Inscrições encerradas' : 'Pagamento indisponível'
                  ) : submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                  ) : (
                    `Confirmar inscrição — R$ ${pagamentoAgora.toFixed(2)}`
                  )}
                </Button>
              </div>
            </div>
          )}

        </form>

        <Dialog open={cardDeniedModalOpen} onOpenChange={setCardDeniedModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pagamento não autorizado</DialogTitle>
              <DialogDescription>
                {cardDeniedMessage || 'Não foi possível autorizar a compra pelo cartão de crédito.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setCardDeniedModalOpen(false)} className="w-full">Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
