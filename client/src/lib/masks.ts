/**
 * Utilitários de máscaras e validações
 */

/**
 * Remove todos os caracteres não numéricos
 */
export function removeNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Aplica máscara de CPF: 999.999.999-99
 */
export function maskCPF(value: string): string {
  const digits = removeNonDigits(value);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Aplica máscara de CNPJ: 99.999.999/9999-99
 */
export function maskCNPJ(value: string): string {
  const digits = removeNonDigits(value);
  
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Aplica máscara de CPF ou CNPJ automaticamente
 */
export function maskCPForCNPJ(value: string): string {
  const digits = removeNonDigits(value);
  
  if (digits.length <= 11) {
    return maskCPF(value);
  }
  return maskCNPJ(value);
}

/**
 * Aplica máscara de telefone: (99) 99999-9999 ou (99) 9999-9999
 */
export function maskPhone(value: string): string {
  const digits = removeNonDigits(value);
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Valida CPF
 */
export function validateCPF(cpf: string): boolean {
  const digits = removeNonDigits(cpf);
  
  if (digits.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(digits.charAt(9))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(digits.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = removeNonDigits(cnpj);
  
  if (digits.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(digits.charAt(12))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(digits.charAt(13))) return false;
  
  return true;
}

/**
 * Valida CPF ou CNPJ
 */
export function validateCPForCNPJ(value: string): boolean {
  const digits = removeNonDigits(value);
  
  if (digits.length === 11) {
    return validateCPF(value);
  }
  if (digits.length === 14) {
    return validateCNPJ(value);
  }
  return false;
}

/**
 * Valida email
 */
export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Aplica máscara de cartão de crédito: 9999 9999 9999 9999
 */
export function maskCreditCard(value: string): string {
  const digits = removeNonDigits(value);
  
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 12) return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
}

/**
 * Aplica máscara de validade do cartão: MM/YYYY
 */
export function maskCardExpiry(value: string): string {
  const digits = removeNonDigits(value);
  
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 6)}`;
}

/**
 * Aplica máscara de CVV: 999 ou 9999
 */
export function maskCVV(value: string): string {
  const digits = removeNonDigits(value);
  return digits.slice(0, 4);
}
