import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, CreditCard, Loader2, QrCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { maskCreditCard, maskCVV, maskCardExpiry, removeNonDigits } from '@/lib/masks';
import { getFriendlyPaymentError } from '@/lib/paymentErrorMessages';
import {
  buscarFormasPagamento,
  iniciarUpgrade,
  listarOpcoesUpgrade,
  verificarStatusUpgrade,
  type PaymentOption,
  type UpgradeOptionsResponse,
  type UpgradeTarget,
} from '@/lib/eventsApi';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

type Step = 'loading' | 'choose' | 'pay' | 'pix' | 'done';

interface UpgradeSectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCode: string;
  eventId: string;
  onUpgraded: () => void;
}

export function UpgradeSectorDialog({
  open,
  onOpenChange,
  orderCode,
  eventId,
  onUpgraded,
}: UpgradeSectorDialogProps) {
  const [step, setStep] = useState<Step>('loading');
  const [options, setOptions] = useState<UpgradeOptionsResponse | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState<string>('');
  const [installments, setInstallments] = useState<number>(1);
  const [card, setCard] = useState({ cardNumber: '', cardHolder: '', expirationDate: '', securityCode: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string | null; qrCodeBase64: string | null } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    stopPolling();
    setStep('loading');
    setOptions(null);
    setSelectedTargetId('');
    setSelectedAttendeeIds([]);
    setPaymentOptions([]);
    setSelectedPaymentOptionId('');
    setInstallments(1);
    setCard({ cardNumber: '', cardHolder: '', expirationDate: '', securityCode: '' });
    setSubmitting(false);
    setPixData(null);
  }, [stopPolling]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setStep('loading');
        const [opts, formas] = await Promise.all([
          listarOpcoesUpgrade(orderCode),
          buscarFormasPagamento(eventId).catch(() => [] as PaymentOption[]),
        ]);
        if (cancelled) return;
        setOptions(opts);
        setPaymentOptions(
          (formas || []).filter((f) => f.isActive && (f.paymentType === 'pix' || f.paymentType === 'credit_card'))
        );
        setStep('choose');
      } catch (err: any) {
        if (cancelled) return;
        toast.error(err?.response?.data?.message || err?.message || 'Não foi possível carregar as opções de upgrade');
        onOpenChange(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderCode, eventId, onOpenChange, resetState]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const selectedTarget: UpgradeTarget | undefined = options?.targets.find((t) => t.batchId === selectedTargetId);

  // Para o destino escolhido, quais inscritos são upgrade (grau menor e diferença > 0)
  const upgradableAttendees = useMemo(() => {
    if (!options || !selectedTarget) return [];
    return options.attendees
      .map((a) => ({ ...a, diferenca: Number((selectedTarget.price - a.price).toFixed(2)) }))
      .filter((a) => a.rank >= 0 && a.rank < selectedTarget.rank && a.diferenca > 0);
  }, [options, selectedTarget]);

  // Ao trocar o destino, seleciona todos os elegíveis por padrão
  useEffect(() => {
    setSelectedAttendeeIds(upgradableAttendees.map((a) => a.id));
  }, [selectedTargetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalDiferenca = useMemo(
    () =>
      upgradableAttendees
        .filter((a) => selectedAttendeeIds.includes(a.id))
        .reduce((sum, a) => sum + a.diferenca, 0),
    [upgradableAttendees, selectedAttendeeIds]
  );

  const selectedPaymentOption = paymentOptions.find((p) => p.id === selectedPaymentOptionId);
  const isCard = selectedPaymentOption?.paymentType === 'credit_card';

  const toggleAttendee = (id: string) => {
    setSelectedAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await verificarStatusUpgrade(orderCode);
        if (status.applied) {
          stopPolling();
          setStep('done');
          toast.success('Upgrade confirmado! Os novos setores já estão no ingresso.');
          onUpgraded();
        }
      } catch {
        /* silencioso */
      }
    }, 4000);
  }, [orderCode, onUpgraded, stopPolling]);

  const podeAvancar = Boolean(selectedTarget) && selectedAttendeeIds.length > 0
    && (selectedTarget?.vagas == null || selectedAttendeeIds.length <= selectedTarget.vagas);

  const handleConfirm = async () => {
    if (!selectedTarget || !selectedPaymentOption || selectedAttendeeIds.length === 0) return;
    if (isCard) {
      const digits = removeNonDigits(card.cardNumber);
      if (digits.length < 13 || !card.cardHolder.trim() || card.expirationDate.length < 5 || card.securityCode.length < 3) {
        toast.error('Preencha os dados do cartão corretamente');
        return;
      }
    }
    setSubmitting(true);
    try {
      const result = await iniciarUpgrade(orderCode, {
        targetBatchId: selectedTarget.batchId,
        attendeeIds: selectedAttendeeIds,
        paymentOptionId: selectedPaymentOption.id,
        paymentData: isCard
          ? {
              cardNumber: removeNonDigits(card.cardNumber),
              cardHolder: card.cardHolder.trim(),
              expirationDate: card.expirationDate,
              securityCode: card.securityCode,
              installments,
            }
          : {},
      });

      const qrCode = result.pagamento?.qrCodeString || result.payment?.pixQrCode || null;
      const qrCodeBase64 = result.pagamento?.qrCodeBase64 || result.payment?.pixQrCodeBase64 || null;

      if (qrCode || qrCodeBase64) {
        setPixData({ qrCode, qrCodeBase64 });
        setStep('pix');
        startPolling();
      } else if (result.payment?.status === 'confirmed') {
        setStep('done');
        toast.success('Upgrade confirmado! Os novos setores já estão no ingresso.');
        onUpgraded();
      } else {
        toast.error('Pagamento não aprovado. Tente outra forma de pagamento.');
      }
    } catch (err: any) {
      toast.error(getFriendlyPaymentError(err) || err?.response?.data?.message || 'Falha ao iniciar o upgrade');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPix = async () => {
    if (!pixData?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      toast.success('Código PIX copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mudar de setor</DialogTitle>
          <DialogDescription>
            Escolha o setor de destino e quem vai subir. Você paga a diferença de todos de uma vez.
          </DialogDescription>
        </DialogHeader>

        {step === 'loading' && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando opções...
          </div>
        )}

        {step === 'choose' && options && (
          <div className="space-y-4">
            {!options.elegivel || options.targets.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {options.motivo || 'Nenhum setor disponível para upgrade no momento.'}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Setor de destino</Label>
                  <RadioGroup value={selectedTargetId} onValueChange={setSelectedTargetId}>
                    {options.targets.map((t) => (
                      <label
                        key={t.batchId}
                        htmlFor={`tgt-${t.batchId}`}
                        className="flex items-center justify-between gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={t.batchId} id={`tgt-${t.batchId}`} />
                          <div>
                            <div className="font-medium">{t.sector || t.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.name} — {formatCurrency(t.price)}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {selectedTarget && (
                  <div className="space-y-2">
                    <Label>Quem vai subir de setor</Label>
                    {upgradableAttendees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum inscrito é elegível para este setor.
                      </p>
                    ) : (
                      upgradableAttendees.map((a) => (
                        <label
                          key={a.id}
                          htmlFor={`att-${a.id}`}
                          className="flex items-center justify-between gap-3 rounded-md border p-2.5 cursor-pointer hover:bg-accent"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`att-${a.id}`}
                              checked={selectedAttendeeIds.includes(a.id)}
                              onCheckedChange={() => toggleAttendee(a.id)}
                            />
                            <div>
                              <div className="font-medium text-sm">{a.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {a.sector || 'Setor atual'} → {selectedTarget.sector || selectedTarget.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-primary">+ {formatCurrency(a.diferenca)}</div>
                        </label>
                      ))
                    )}
                    {selectedTarget.vagas != null && selectedAttendeeIds.length > selectedTarget.vagas && (
                      <p className="text-xs text-destructive">
                        Não há vagas suficientes neste setor para todos os selecionados. Selecione menos inscritos.
                      </p>
                    )}
                  </div>
                )}

                {totalDiferenca > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
                    <span>Total a pagar</span>
                    <strong className="text-primary text-base">{formatCurrency(totalDiferenca)}</strong>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={!podeAvancar} onClick={() => setStep('pay')}>
                    Continuar <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}

        {step === 'pay' && selectedTarget && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              Upgrade de <strong>{selectedAttendeeIds.length} inscrito(s)</strong> para{' '}
              <strong>{selectedTarget.sector || selectedTarget.name}</strong> — total:{' '}
              <strong className="text-primary">{formatCurrency(totalDiferenca)}</strong>
            </div>

            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={selectedPaymentOptionId} onValueChange={setSelectedPaymentOptionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.paymentType === 'pix' ? 'PIX' : 'Cartão de crédito'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCard && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Número do cartão</Label>
                  <Input
                    inputMode="numeric"
                    value={card.cardNumber}
                    onChange={(e) => setCard((c) => ({ ...c, cardNumber: maskCreditCard(e.target.value) }))}
                    placeholder="0000 0000 0000 0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome impresso no cartão</Label>
                  <Input
                    value={card.cardHolder}
                    onChange={(e) => setCard((c) => ({ ...c, cardHolder: e.target.value.toUpperCase() }))}
                    placeholder="COMO ESTÁ NO CARTÃO"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Validade</Label>
                    <Input
                      inputMode="numeric"
                      value={card.expirationDate}
                      onChange={(e) => setCard((c) => ({ ...c, expirationDate: maskCardExpiry(e.target.value) }))}
                      placeholder="MM/AA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV</Label>
                    <Input
                      inputMode="numeric"
                      value={card.securityCode}
                      onChange={(e) => setCard((c) => ({ ...c, securityCode: maskCVV(e.target.value) }))}
                      placeholder="123"
                    />
                  </div>
                </div>
                {selectedPaymentOption && selectedPaymentOption.maxInstallments > 1 && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: selectedPaymentOption.maxInstallments }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O parcelamento pode incluir juros, exibidos na fatura do cartão.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('choose')} disabled={submitting}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedPaymentOptionId || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Processando...
                  </>
                ) : (
                  <>
                    {isCard ? <CreditCard className="h-4 w-4 mr-1" /> : <QrCode className="h-4 w-4 mr-1" />}
                    Pagar {formatCurrency(totalDiferenca)}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'pix' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code ou copie o código PIX. O upgrade é confirmado automaticamente após o pagamento.
            </p>
            {pixData?.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code PIX"
                className="mx-auto h-52 w-52 rounded-md border"
              />
            )}
            {pixData?.qrCode && (
              <Button variant="outline" onClick={copyPix} className="w-full">
                Copiar código PIX
              </Button>
            )}
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Aguardando confirmação do pagamento...
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center py-6">
            <div className="text-lg font-semibold text-primary">Upgrade concluído! 🎉</div>
            <p className="text-sm text-muted-foreground">
              O ingresso foi atualizado com os novos setores e reenviado.
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeSectorDialog;
