const CIELO_RETURN_CODE_REASON: Record<string, string> = {
  '05': 'Transação não autorizada (genérica). Contate o banco emissor',
  '14': 'Número do cartão inválido',
  '51': 'Saldo ou limite insuficiente',
  '57': 'Transação não permitida para o cartão',
  '61': 'Valor excedido para a operação',
  '78': 'Cartão novo sem desbloqueio',
  '82': 'Transação não autorizada devido à regra do emissor',
  '83': 'Transação suspeita de fraude pelo banco emissor',
  '91': 'Emissor fora do ar',
  '96': 'Falha de sistema/comunicação com o emissor',
  '5C': 'Bloqueio preventivo antifraude do banco do cliente',
  AI: 'Autenticação não foi realizada pelo portador',
  N7: 'Violação de segurança (CVV inválido ou não informado)',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectValue = (obj: unknown, key: string): unknown => {
  if (!isRecord(obj)) return undefined;
  return obj[key];
};

const sanitizeCode = (code: unknown): string | undefined => {
  if (code === null || code === undefined) return undefined;
  const normalized = String(code).trim().toUpperCase();
  return normalized || undefined;
};

const getPaymentSource = (registration: unknown): unknown => {
  const payments = getObjectValue(registration, 'payments');
  if (Array.isArray(payments)) {
    const creditCardPayment = payments.find((payment) => {
      const method = String(getObjectValue(payment, 'method') || '').toLowerCase();
      return method === 'credit_card';
    });
    if (creditCardPayment) {
      return getObjectValue(creditCardPayment, 'providerPayload') || creditCardPayment;
    }
  }
  return getObjectValue(registration, 'cieloResponse');
};

const getPaymentNode = (source: unknown): unknown =>
  getObjectValue(source, 'Payment') || source;

export const extractCieloReturnCode = (registration: unknown): string | undefined => {
  const source = getPaymentSource(registration);
  const paymentNode = getPaymentNode(source);
  return sanitizeCode(getObjectValue(paymentNode, 'ReturnCode'));
};

export const extractCieloReturnMessage = (registration: unknown): string | undefined => {
  const source = getPaymentSource(registration);
  const paymentNode = getPaymentNode(source);
  const rawMessage = getObjectValue(paymentNode, 'ReturnMessage');
  if (rawMessage === null || rawMessage === undefined) return undefined;
  const normalized = String(rawMessage).trim();
  return normalized || undefined;
};

export const getCieloDeniedReason = (registration: unknown): string | undefined => {
  const code = extractCieloReturnCode(registration);
  if (!code) return undefined;
  return CIELO_RETURN_CODE_REASON[code];
};

export const getCieloDeniedMessage = (registration: unknown): string | undefined => {
  const code = extractCieloReturnCode(registration);
  const mappedReason = getCieloDeniedReason(registration);
  const returnMessage = extractCieloReturnMessage(registration);

  if (mappedReason && code) {
    return `Pagamento negado. ${mappedReason} (código ${code}).`;
  }

  if (returnMessage && code) {
    return `Pagamento negado. ${returnMessage} (código ${code}).`;
  }

  if (mappedReason) {
    return `Pagamento negado. ${mappedReason}.`;
  }

  if (returnMessage) {
    return `Pagamento negado. ${returnMessage}.`;
  }

  return undefined;
};
