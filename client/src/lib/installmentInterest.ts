import type { PaymentOption } from '@/lib/eventsApi';

export type InterestType = 'percentage' | 'fixed';

export interface InstallmentInterestRule {
  installments: number;
  interestRate: number;
  interestType: InterestType;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toInterestType = (value: unknown, fallback: InterestType = 'percentage'): InterestType => {
  return value === 'fixed' || value === 'percentage' ? value : fallback;
};

const extractRulesFromArray = (
  source: unknown,
  fallbackType: InterestType
): InstallmentInterestRule[] => {
  if (!Array.isArray(source)) return [];
  return source
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const installments =
        toNumber(entry.installments) ??
        toNumber(entry.installment) ??
        toNumber(entry.parcelas) ??
        toNumber(entry.parcela);
      const interestRate =
        toNumber(entry.interestRate) ??
        toNumber(entry.rate) ??
        toNumber(entry.juros) ??
        toNumber(entry.value);
      if (!installments || installments < 1 || interestRate === null) return null;
      const interestType = toInterestType(entry.interestType ?? entry.type, fallbackType);
      return {
        installments: Math.trunc(installments),
        interestRate,
        interestType,
      };
    })
    .filter((rule): rule is InstallmentInterestRule => Boolean(rule));
};

const extractRulesFromRecord = (
  source: unknown,
  fallbackType: InterestType
): InstallmentInterestRule[] => {
  if (!isRecord(source)) return [];
  return Object.entries(source)
    .map(([key, value]) => {
      const installments = toNumber(key);
      if (!installments || installments < 1) return null;
      if (isRecord(value)) {
        const interestRate =
          toNumber(value.interestRate) ??
          toNumber(value.rate) ??
          toNumber(value.juros) ??
          toNumber(value.value);
        if (interestRate === null) return null;
        const interestType = toInterestType(value.interestType ?? value.type, fallbackType);
        return {
          installments: Math.trunc(installments),
          interestRate,
          interestType,
        };
      }
      const interestRate = toNumber(value);
      if (interestRate === null) return null;
      return {
        installments: Math.trunc(installments),
        interestRate,
        interestType: fallbackType,
      };
    })
    .filter((rule): rule is InstallmentInterestRule => Boolean(rule));
};

const getInstallmentRules = (option?: PaymentOption): InstallmentInterestRule[] => {
  if (!option) return [];
  const optionRecord = option as unknown as Record<string, unknown>;
  const fallbackType = toInterestType(option.interestType, 'percentage');

  const fromInstallmentInterestRates = [
    ...extractRulesFromArray(option.installmentInterestRates, fallbackType),
    ...extractRulesFromRecord(option.installmentInterestRates, fallbackType),
  ];
  if (fromInstallmentInterestRates.length > 0) {
    return fromInstallmentInterestRates;
  }

  const fromArrays = [extractRulesFromArray(optionRecord.installmentInterestRates, fallbackType)].flat();

  const fromRecords = [
    extractRulesFromRecord(optionRecord.installmentInterestRates, fallbackType),
    extractRulesFromRecord(optionRecord.interestRatesByInstallment, fallbackType),
    extractRulesFromRecord(optionRecord.installmentInterestMap, fallbackType),
    extractRulesFromRecord(optionRecord.installmentRatesMap, fallbackType),
  ].flat();

  return [...fromArrays, ...fromRecords];
};

export const getInstallmentInterestRule = (
  option: PaymentOption | undefined,
  installments: number
): InstallmentInterestRule => {
  if (!option || installments <= 1) {
    return { installments: Math.max(1, installments), interestRate: 0, interestType: 'percentage' };
  }

  const normalizedInstallments = Math.max(1, Math.trunc(installments));
  const rules = getInstallmentRules(option);
  const exactRule = rules.find((rule) => rule.installments === normalizedInstallments);
  if (exactRule) return exactRule;

  if (rules.length > 0) {
    return {
      installments: normalizedInstallments,
      interestRate: 0,
      interestType: 'percentage',
    };
  }

  return {
    installments: normalizedInstallments,
    interestRate: Number(option.interestRate || 0),
    interestType: toInterestType(option.interestType, 'percentage'),
  };
};

export const applyInstallmentInterest = (
  baseAmount: number,
  option: PaymentOption | undefined,
  installments: number
): number => {
  const safeBase = Math.max(0, baseAmount);
  const rule = getInstallmentInterestRule(option, installments);
  if (rule.interestRate <= 0 || installments <= 1) return safeBase;
  if (rule.interestType === 'fixed') return safeBase + rule.interestRate;
  return safeBase + safeBase * (rule.interestRate / 100);
};

export const calculateInstallmentInterestAmount = (
  baseAmount: number,
  option: PaymentOption | undefined,
  installments: number
): number => {
  const safeBase = Math.max(0, baseAmount);
  const totalWithInterest = applyInstallmentInterest(safeBase, option, installments);
  return Number(Math.max(0, totalWithInterest - safeBase).toFixed(2));
};

export const formatInstallmentInterest = (rule: InstallmentInterestRule): string => {
  if (rule.interestRate <= 0) return 'sem taxas';
  if (rule.interestType === 'fixed') return `R$ ${rule.interestRate.toFixed(2)} fixo`;
  return `${rule.interestRate}%`;
};
