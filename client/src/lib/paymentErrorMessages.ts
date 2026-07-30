/**
 * Tradução de mensagens de erro de pagamento (Cielo) para português.
 *
 * A API do portal (`POST /registrations/:id/payments`) devolve, quando a Cielo
 * recusa a transação por validação, mensagens como:
 *
 *   { message: "Erro no pagamento: SecurityCode length exceeded" }
 *   { message: "Erro no pagamento: SecurityCode length exceeded, Credit Card Expiration Date is invalid" }
 *
 * Esses são erros de *validação* da Cielo (HTTP 400) — o cartão nem chega a ser
 * cobrado. As mensagens vêm em inglês e separadas por vírgula. Este módulo
 * transforma esse texto técnico em algo legível para o usuário final.
 */

type Rule = { test: RegExp; pt: string };

// Regras aplicadas a cada fragmento (case-insensitive). A primeira que casar vence.
const CIELO_MESSAGE_RULES: Rule[] = [
  // Código de segurança (CVV / CVC)
  {
    test: /security\s*code.*(exceed|length|invalid|inv[aá]lid)/i,
    pt: 'Código de segurança (CVV) inválido — confira os 3 ou 4 dígitos no verso do cartão.',
  },
  { test: /security\s*code.*(required|obrigat)/i, pt: 'Informe o código de segurança (CVV) do cartão.' },

  // Data de validade
  { test: /expiration\s*date.*(invalid|inv[aá]lid)/i, pt: 'Data de validade do cartão inválida — use o formato MM/AAAA.' },
  { test: /expiration\s*date.*(required|obrigat)/i, pt: 'Informe a data de validade do cartão.' },
  { test: /(card.*expired|expired.*card|cart[aã]o.*vencid)/i, pt: 'Cartão vencido.' },

  // Número do cartão
  { test: /(invalid\s*card\s*number|card\s*number.*(exceed|length|invalid))/i, pt: 'Número do cartão inválido.' },
  { test: /card\s*number.*(required|obrigat)/i, pt: 'Informe o número do cartão.' },

  // Titular
  { test: /holder.*(exceed|length)/i, pt: 'Nome do titular do cartão é muito longo.' },
  { test: /holder.*(required|obrigat)/i, pt: 'Informe o nome do titular do cartão.' },

  // Bandeira
  { test: /brand.*(invalid|required|obrigat)/i, pt: 'Bandeira do cartão inválida ou não informada.' },

  // Parcelas
  { test: /installments?.*(invalid|greater|must|obrigat)/i, pt: 'Número de parcelas inválido.' },

  // Valor
  { test: /amount.*(greater|invalid|must|zero)/i, pt: 'Valor do pagamento inválido.' },

  // Recusas pós-autorização que chegam como texto
  { test: /(not\s*authorized|n[aã]o\s*autorizad|denied|recusad)/i, pt: 'Pagamento não autorizado pelo banco emissor.' },
  { test: /(insufficient|saldo|limit)/i, pt: 'Saldo ou limite insuficiente no cartão.' },
  { test: /(fraud|suspeita)/i, pt: 'Transação recusada por suspeita de fraude pelo banco emissor.' },
  { test: /(timeout|fora do ar|unavailable|indispon)/i, pt: 'Falha de comunicação com o banco emissor. Tente novamente em instantes.' },
];

const FALLBACK_MESSAGE =
  'Não foi possível processar o pagamento. Confira os dados do cartão e tente novamente.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getValue = (obj: unknown, key: string): unknown => (isRecord(obj) ? obj[key] : undefined);

/** Remove o prefixo "Erro no pagamento:" que o backend adiciona. */
const stripPrefix = (message: string): string =>
  message.replace(/^\s*erro\s+no\s+pagamento\s*:\s*/i, '').trim();

const translateFragment = (fragment: string): string => {
  const clean = fragment.trim();
  if (!clean) return '';
  const rule = CIELO_MESSAGE_RULES.find((r) => r.test.test(clean));
  // Sem regra correspondente: devolve o texto original (melhor que esconder o motivo).
  return rule ? rule.pt : clean;
};

/**
 * Traduz uma mensagem de erro de pagamento crua para português.
 * Aceita mensagens compostas (separadas por vírgula/ponto-e-vírgula).
 */
export const translatePaymentError = (
  rawMessage?: unknown,
  fallback: string = FALLBACK_MESSAGE
): string => {
  if (typeof rawMessage !== 'string' || !rawMessage.trim()) return fallback;

  const body = stripPrefix(rawMessage);
  if (!body) return fallback;

  const fragments = body
    .split(/[,;]+/)
    .map(translateFragment)
    .filter(Boolean);

  // Remove duplicatas preservando a ordem (ex.: dois erros que caem na mesma regra).
  const unique = Array.from(new Set(fragments));

  return unique.length ? unique.join(' ') : fallback;
};

/**
 * Extrai a mensagem de erro de um erro do axios / resposta da API.
 * Procura em `error.response.data` (string ou { message | error }) e cai
 * para `error.message`.
 */
export const extractPaymentErrorMessage = (error: unknown): string | undefined => {
  const data = getValue(getValue(error, 'response'), 'data');

  if (typeof data === 'string' && data.trim()) return data;

  const dataMessage = getValue(data, 'message');
  if (typeof dataMessage === 'string' && dataMessage.trim()) return dataMessage;

  const dataError = getValue(data, 'error');
  if (typeof dataError === 'string' && dataError.trim()) return dataError;

  const message = getValue(error, 'message');
  if (typeof message === 'string' && message.trim()) return message;

  return undefined;
};

/**
 * Atalho: extrai a mensagem de um erro do axios e já devolve traduzida.
 */
export const getFriendlyPaymentError = (error: unknown, fallback: string = FALLBACK_MESSAGE): string =>
  translatePaymentError(extractPaymentErrorMessage(error), fallback);
