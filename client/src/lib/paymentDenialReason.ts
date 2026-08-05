// Motivos de recusa da Cielo (tabela ABECS + códigos próprios da Cielo) com
// redação voltada ao comprador: explica o motivo e o que fazer. O texto é
// encaixado no formato "Pagamento negado. {motivo} (código {code})." — por isso
// nenhum motivo termina com ponto final.
const CIELO_RETURN_CODE_REASON: Record<string, string> = {
  '01': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco do cartão',
  '02': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco do cartão',
  '03': 'Não foi possível processar o pagamento com este estabelecimento. Tente outro cartão',
  '04': 'Cartão bloqueado ou retido pelo banco emissor. Entre em contato com o banco',
  '05': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco do cartão',
  '06': 'Houve um problema com o cartão. Confira os dados ou fale com o banco emissor',
  '07': 'Cartão bloqueado pelo banco emissor. Entre em contato com o banco',
  '12': 'Não foi possível processar esta transação. Confira os dados do cartão',
  '13': 'Valor da compra inválido. Tente novamente',
  '14': 'Número do cartão inválido. Confira os dígitos e tente novamente',
  '15': 'Banco emissor do cartão não localizado. Confira o número do cartão',
  '19': 'Não foi possível concluir o pagamento. Tente novamente em instantes',
  '21': 'Não foi possível concluir a operação. Tente novamente',
  '22': 'Parcelamento inválido para este cartão. Tente outra quantidade de parcelas',
  '23': 'Valor da parcela inválido. Tente outra quantidade de parcelas',
  '24': 'Quantidade de parcelas inválida. Escolha outra opção de parcelamento',
  '30': 'Não foi possível processar o pagamento. Tente novamente',
  '38': 'Número de tentativas de senha excedido. Entre em contato com o banco emissor',
  '39': 'Este cartão não permite compras no crédito. Use outro cartão',
  '41': 'Cartão informado como perdido. Entre em contato com o banco emissor',
  '43': 'Cartão informado como roubado. Entre em contato com o banco emissor',
  '46': 'Conta do cartão encerrada. Use outro cartão',
  '51': 'Saldo ou limite insuficiente. Verifique com o banco emissor ou use outro cartão',
  '52': 'Conta corrente inválida. Confira os dados ou fale com o banco',
  '53': 'Conta poupança inválida. Confira os dados ou fale com o banco',
  '54': 'Cartão vencido. Confira a validade ou use outro cartão',
  '55': 'Senha inválida. Tente novamente',
  '56': 'Dados do cartão incorretos. Confira o número e tente novamente',
  '57': 'Este cartão não permite este tipo de compra. Use outro cartão ou fale com o banco',
  '58': 'Transação não permitida. Tente outro cartão',
  '59': 'Compra recusada por suspeita de fraude pelo banco emissor. Entre em contato com o banco',
  '60': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco',
  '61': 'Valor excede o limite permitido do cartão. Fale com o banco emissor',
  '62': 'Cartão bloqueado ou com restrição. Entre em contato com o banco emissor',
  '63': 'Falha de segurança na transação. Confira os dados do cartão',
  '64': 'Valor da compra inválido. Tente novamente',
  '65': 'Limite de compras do cartão excedido. Entre em contato com o banco emissor',
  '66': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco',
  '67': 'Cartão bloqueado para compras hoje. Entre em contato com o banco emissor',
  '70': 'Limite excedido ou saldo insuficiente. Fale com o banco emissor ou use outro cartão',
  '72': 'Não foi possível concluir a operação. Tente novamente',
  '74': 'Senha vencida. Entre em contato com o banco emissor',
  '75': 'Número de tentativas de senha excedido. Entre em contato com o banco emissor',
  '76': 'Não foi possível concluir a operação. Confira os dados do cartão',
  '77': 'Dados do cartão inconsistentes. Confira as informações e tente novamente',
  '78': 'Cartão novo ainda sem desbloqueio. Desbloqueie com o banco emissor e tente novamente',
  '79': 'Este cartão não permite este tipo de compra. Use outro cartão',
  '80': 'Não foi possível processar o pagamento. Tente novamente',
  '81': 'Função bloqueada para este cartão. Entre em contato com o banco emissor',
  '82': 'Compra não autorizada por regra do banco emissor. Entre em contato com o banco',
  '83': 'Compra recusada por suspeita de fraude pelo banco emissor. Entre em contato com o banco',
  '85': 'Não foi possível concluir a operação. Tente novamente',
  '86': 'Senha inválida. Tente novamente',
  '88': 'Senha vencida. Entre em contato com o banco emissor',
  '89': 'Houve um erro ao processar o pagamento. Tente novamente',
  '90': 'Não foi possível concluir a operação. Tente novamente',
  '91': 'Banco emissor temporariamente indisponível. Tente novamente em instantes',
  '92': 'Banco emissor do cartão não localizado. Confira os dados do cartão',
  '93': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco',
  '94': 'Pagamento identificado como duplicado. Aguarde antes de tentar novamente',
  '96': 'Falha de comunicação com o banco emissor. Tente novamente em instantes',
  '97': 'Valor não permitido para esta compra. Tente novamente',
  '98': 'Serviço temporariamente indisponível. Tente novamente em instantes',
  '99': 'Banco emissor temporariamente indisponível. Tente novamente em instantes',
  '100': 'Compra não autorizada pelo banco emissor. Entre em contato com o banco',
  '101': 'Cartão vencido. Confira a validade ou use outro cartão',
  '102': 'Compra recusada por suspeita de fraude pelo banco emissor. Entre em contato com o banco',
  '106': 'Número de tentativas de senha excedido. Entre em contato com o banco emissor',
  '109': 'Não foi possível processar o pagamento com este estabelecimento. Tente outro cartão',
  '110': 'Valor da compra inválido. Tente novamente',
  '115': 'Houve um problema com o cartão. Confira os dados e tente novamente',
  '116': 'Saldo ou limite insuficiente. Verifique com o banco emissor ou use outro cartão',
  '117': 'Senha inválida. Tente novamente',
  '121': 'Saldo ou limite insuficiente. Verifique com o banco emissor ou use outro cartão',
  '122': 'Dados do cartão incorretos. Confira o número e tente novamente',
  '180': 'Senha vencida. Entre em contato com o banco emissor',
  '181': 'Não foi possível processar o pagamento. Tente novamente',
  '200': 'Este cartão não permite este tipo de compra. Use outro cartão',
  '475': 'A operação demorou mais que o esperado. Tente novamente',
  '911': 'Falha de comunicação com o banco emissor. Tente novamente em instantes',
  '912': 'Banco emissor temporariamente indisponível. Tente novamente em instantes',
  '999': 'Serviço temporariamente indisponível. Tente novamente em instantes',
  '5C': 'Bloqueio preventivo antifraude do banco emissor. Entre em contato com o banco',
  '6P': 'Não foi possível validar os dados do cartão. Confira as informações e tente novamente',
  AA: 'A operação demorou mais que o esperado. Tente novamente',
  AB: 'Função de pagamento incorreta. Use outro cartão',
  AC: 'Função de pagamento incorreta. Use outro cartão',
  AF: 'Não foi possível concluir a operação. Tente novamente',
  AG: 'Não foi possível concluir a operação. Tente novamente',
  AH: 'Cartão de crédito usado como débito. Escolha a opção crédito',
  AI: 'A autenticação do cartão não foi concluída. Tente novamente',
  AJ: 'Tipo de transação inválido para este cartão. Use outro cartão',
  AV: 'Dados do cartão inválidos. Confira as informações e tente novamente',
  BD: 'Não foi possível concluir a operação. Tente novamente',
  BL: 'Limite diário do cartão excedido. Entre em contato com o banco emissor',
  BM: 'Cartão inválido. Confira os dados ou use outro cartão',
  BN: 'Cartão ou conta bloqueados. Entre em contato com o banco emissor',
  BO: 'Não foi possível concluir a operação. Tente novamente',
  BP: 'Conta do cartão não localizada. Confira os dados ou use outro cartão',
  BP171: 'Compra recusada por segurança antifraude. Entre em contato com o banco emissor',
  BP176: 'Transação não permitida. Tente outro cartão',
  BP900: 'Não foi possível concluir a operação. Tente novamente',
  BP901: 'Não foi possível concluir a operação. Tente novamente',
  BP902: 'Aguarde a conclusão da operação anterior e tente novamente',
  BP903: 'Não foi possível concluir o cancelamento. Tente novamente',
  BP904: 'Não foi possível concluir a consulta. Tente novamente',
  BR: 'Conta do cartão encerrada. Use outro cartão',
  C1: 'Este cartão não pode ser usado no débito. Use a função crédito',
  C2: 'Transação não permitida. Tente outro cartão',
  C3: 'Período inválido para este tipo de compra. Tente novamente mais tarde',
  CF: 'Não foi possível validar os dados do cartão. Confira as informações',
  CG: 'Não foi possível validar os dados do cartão. Confira as informações',
  DF: 'Cartão inválido ou com falha. Use outro cartão',
  DM: 'Limite excedido ou saldo insuficiente. Fale com o banco emissor ou use outro cartão',
  DQ: 'Não foi possível validar os dados do cartão. Confira as informações',
  DS: 'Este cartão não permite este tipo de compra. Use outro cartão',
  EB: 'Número de parcelas maior que o permitido. Escolha outra opção',
  EE: 'Valor da parcela abaixo do mínimo permitido. Escolha menos parcelas',
  EK: 'Este cartão não permite este tipo de compra. Use outro cartão',
  FC: 'Entre em contato com o banco emissor do cartão',
  FE: 'Não foi possível processar o pagamento. Tente novamente',
  FG: 'Entre em contato com a Amex',
  FM: 'Não foi possível processar o pagamento. Use outro cartão',
  GA: 'Aguarde o contato do banco emissor para autorizar a compra',
  GD: 'Transação não permitida. Tente outro cartão',
  GF: 'Compra recusada pelo banco emissor. Entre em contato com o banco',
  GK: 'Cartão temporariamente bloqueado por segurança. Aguarde e tente novamente',
  GT: 'Compra bloqueada por segurança. Aguarde e tente novamente',
  HJ: 'Não foi possível concluir a operação. Tente novamente',
  IA: 'Não foi possível concluir a operação. Tente novamente',
  KA: 'Não foi possível validar os dados do cartão. Confira as informações',
  KB: 'Opção selecionada incorreta. Tente novamente',
  KE: 'Não foi possível validar os dados do cartão. Confira as informações',
  N0: 'Não foi possível concluir a operação. Tente novamente',
  N3: 'Operação não disponível para este cartão. Use outro cartão',
  N4: 'Valor excede o limite permitido do cartão. Fale com o banco emissor',
  N7: 'Código de segurança (CVV) inválido ou não informado. Confira os dígitos no verso do cartão',
  N8: 'Divergência no valor da transação. Tente novamente',
  NR: 'Transação não permitida. Tente outro cartão',
  P5: 'É necessário trocar a senha ou desbloquear o cartão com o banco emissor',
  P6: 'Nova senha não aceita. Entre em contato com o banco emissor',
  RP: 'Transação não permitida. Tente outro cartão',
  SC: 'Transação não permitida. Tente outro cartão',
  U3: 'Não foi possível validar os dados do cartão. Confira as informações',
  B1: 'Tarifa adicional não suportada por este cartão. Use outro cartão',
  B2: 'Tarifa adicional não suportada por este cartão. Use outro cartão',
  R0: 'Pagamento recorrente suspenso para este serviço pelo banco emissor',
  R1: 'Pagamentos recorrentes suspensos pelo banco emissor',
  R2: 'Este cartão não está habilitado para esta compra. Use outro cartão',
  R3: 'Autorizações recorrentes suspensas pelo banco emissor',
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
