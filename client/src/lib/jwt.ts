export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Retorna o ID do usuário a partir do accessToken (testa todos os campos comuns) */
export function getUserIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  console.debug('[JWT payload]', payload);
  return (
    payload.sub ??
    payload.id ??
    payload.userId ??
    payload.user_id ??
    payload._id ??
    null
  );
}
