import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { maskCPForCNPJ, maskPhone } from '@/lib/masks';
import { SignaturePad } from '@/components/SignaturePad';
import { TermDocument } from '@/components/TermDocument';
import type { Event, LiabilityTerm, TermAcceptance } from '@/lib/eventsApi';

interface AttendeeInput {
  index: number;
  data: Record<string, any>;
}

interface LiabilityTermDialogProps {
  open: boolean;
  term: LiabilityTerm;
  event: Pick<Event, 'title' | 'startDate' | 'location'>;
  attendees: AttendeeInput[];
  onCancel: () => void;
  onConfirm: (acceptances: TermAcceptance[]) => void;
}

type StdKey = 'PARTICIPANTE_NOME' | 'RESPONSAVEL_NOME' | 'RESPONSAVEL_CPF'
  | 'CONTATO_EMERGENCIA_NOME' | 'CONTATO_EMERGENCIA_WHATSAPP';
type StdValues = Record<StdKey, string>;

const STANDARD_INPUTS: Array<{ key: StdKey; label: string; type: 'text' | 'cpf' | 'phone' }> = [
  { key: 'RESPONSAVEL_NOME', label: 'Nome do responsável', type: 'text' },
  { key: 'RESPONSAVEL_CPF', label: 'CPF do responsável', type: 'cpf' },
  { key: 'CONTATO_EMERGENCIA_NOME', label: 'Contato de emergência (nome)', type: 'text' },
  { key: 'CONTATO_EMERGENCIA_WHATSAPP', label: 'Contato de emergência (WhatsApp)', type: 'phone' },
];

function fmtDate(d?: string): string {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR');
}

function val(data: Record<string, any> = {}, field?: string | null): string {
  if (!field) return '';
  const v = data?.[field];
  return v != null ? String(v).trim() : '';
}

function pick(data: Record<string, any> = {}, candidates: string[]): string {
  for (const key of candidates) {
    if (data?.[key] != null && String(data[key]).trim() !== '') return String(data[key]).trim();
  }
  const entries = Object.entries(data || {});
  for (const cand of candidates) {
    const hit = entries.find(([k]) => k.toLowerCase().includes(cand.toLowerCase()));
    if (hit && hit[1] != null && String(hit[1]).trim() !== '') return String(hit[1]).trim();
  }
  return '';
}

// Resolve os placeholders padrão a partir do inscrito de forma ESTRITA:
// responsável só pelo campo mapeado (designação) — sem heurística frouxa que
// pegaria o dado do próprio participante. Emergência não tem mapeamento → sempre
// coletado quando o termo o exige. Nome do participante pode usar heurística (é o próprio).
function resolveStd(term: LiabilityTerm, data: Record<string, any>): StdValues {
  return {
    PARTICIPANTE_NOME: val(data, term.participantNameField)
      || pick(data, ['nome_completo', 'nome', 'name', 'nome_participante']),
    RESPONSAVEL_NOME: val(data, term.signerNameField),
    RESPONSAVEL_CPF: val(data, term.signerDocumentField),
    CONTATO_EMERGENCIA_NOME: '',
    CONTATO_EMERGENCIA_WHATSAPP: '',
  };
}

function refs(term: LiabilityTerm, key: string): boolean {
  return new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(String(term.contentHtml || ''));
}

const PAGE_BREAK_MARKER = '<div data-pagebreak="1" style="border-top:2px dashed #bbb;color:#999;font-size:10px;text-align:center;margin:6px 0">— quebra de página —</div>';

function applyPageBreaks(html: string): string {
  return html.replace(/(<p>\s*)?\{\{\s*QUEBRA_PAGINA\s*\}\}(\s*<\/p>)?/g, PAGE_BREAK_MARKER);
}

// Preenche {{...}} e converte {{QUEBRA_PAGINA}} num marcador de quebra.
function renderTerm(
  html: string, attendeeData: Record<string, any>,
  event: LiabilityTermDialogProps['event'], std: StdValues,
): string {
  const system: Record<string, string> = {
    EVENTO_NOME: event.title || '',
    EVENTO_DATA: fmtDate(event.startDate),
    EVENTO_LOCAL: event.location || '',
    DATA_ASSINATURA: new Date().toLocaleDateString('pt-BR'),
  };
  const filled = String(html || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, key: string) => {
    if (key === 'QUEBRA_PAGINA') return m;
    if (system[key] != null) return system[key];
    if ((std as Record<string, string>)[key]) return (std as Record<string, string>)[key];
    if (attendeeData?.[key] != null) return String(attendeeData[key]);
    return '';
  });
  return DOMPurify.sanitize(applyPageBreaks(filled));
}

export function LiabilityTermDialog({
  open, term, event, attendees, onCancel, onConfirm,
}: LiabilityTermDialogProps) {
  const mode = term.signatureMode || 'DRAW';
  const requireDoc = term.requireDocument !== false;

  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const [signatures, setSignatures] = useState<Record<number, string | null>>({});
  // Valores coletados na assinatura por participante (quando o inscrito não traz o dado).
  const [collected, setCollected] = useState<Record<number, Partial<StdValues>>>({});

  // Quais campos padrão precisam ser coletados (referenciados/obrigatórios e não resolvidos).
  const isNeeded = (key: StdKey, resolved: StdValues): boolean => {
    if (resolved[key]) return false;
    // Marcado explicitamente no admin para coletar na assinatura.
    if (Array.isArray(term.collectFields) && term.collectFields.includes(key)) return true;
    if (key === 'RESPONSAVEL_CPF') return requireDoc || refs(term, key);
    if (key === 'RESPONSAVEL_NOME') return refs(term, key) || mode === 'TYPED';
    return refs(term, key); // contatos de emergência: só se o termo os usa
  };

  const perAttendee = useMemo(() => attendees.map((att) => {
    const resolved = resolveStd(term, att.data);
    const coll = collected[att.index] || {};
    const effective: StdValues = {
      PARTICIPANTE_NOME: resolved.PARTICIPANTE_NOME || `Participante ${att.index + 1}`,
      RESPONSAVEL_NOME: resolved.RESPONSAVEL_NOME || coll.RESPONSAVEL_NOME || '',
      RESPONSAVEL_CPF: resolved.RESPONSAVEL_CPF || coll.RESPONSAVEL_CPF || '',
      CONTATO_EMERGENCIA_NOME: resolved.CONTATO_EMERGENCIA_NOME || coll.CONTATO_EMERGENCIA_NOME || '',
      CONTATO_EMERGENCIA_WHATSAPP: resolved.CONTATO_EMERGENCIA_WHATSAPP || coll.CONTATO_EMERGENCIA_WHATSAPP || '',
    };
    const needed = STANDARD_INPUTS.filter((f) => isNeeded(f.key, resolved));
    const html = renderTerm(term.contentHtml, att.data, event, effective);
    return {
      att, resolved, effective, needed, html,
    };
  }), [attendees, term, event, collected]);

  const setColl = (index: number, key: StdKey, value: string) => setCollected((prev) => ({
    ...prev, [index]: { ...(prev[index] || {}), [key]: value },
  }));

  const attendeeValid = (p: typeof perAttendee[number]): boolean => {
    if (!accepted[p.att.index]) return false;
    if (mode === 'DRAW' && !signatures[p.att.index]) return false;
    if (requireDoc && p.effective.RESPONSAVEL_CPF.replace(/\D/g, '').length < 11) return false;
    for (const f of p.needed) {
      if (!p.effective[f.key] || !String(p.effective[f.key]).trim()) return false;
    }
    return true;
  };

  const allValid = perAttendee.every(attendeeValid);

  const handleConfirm = () => {
    if (!allValid) return;
    const acceptances: TermAcceptance[] = perAttendee.map((p) => ({
      attendeeIndex: p.att.index,
      accepted: true,
      signatureImage: mode === 'DRAW' ? (signatures[p.att.index] || null) : null,
      signerName: p.effective.RESPONSAVEL_NOME || undefined,
      signerDocument: p.effective.RESPONSAVEL_CPF || undefined,
      participantName: p.effective.PARTICIPANTE_NOME || undefined,
      emergencyContactName: p.effective.CONTATO_EMERGENCIA_NOME || undefined,
      emergencyContactPhone: p.effective.CONTATO_EMERGENCIA_WHATSAPP || undefined,
    }));
    onConfirm(acceptances);
  };

  const maskFor = (type: 'text' | 'cpf' | 'phone', v: string) => {
    if (type === 'cpf') return maskCPForCNPJ(v);
    if (type === 'phone') return maskPhone(v);
    return v;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{term.title || 'Termo de Responsabilidade'}</DialogTitle>
          <DialogDescription>
            Leia com atenção e assine o termo de cada participante para prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {perAttendee.map((p) => (
            <div key={p.att.index} className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">{p.effective.PARTICIPANTE_NOME}</p>

              <TermDocument
                html={p.html}
                backgroundImageUrl={term.backgroundImageUrl}
                topOffset={term.contentTopOffset || 0}
                bottomOffset={term.contentBottomOffset || 0}
              />

              {/* Campos padrão coletados quando não vêm nos dados do inscrito */}
              {p.needed.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {p.needed.map((f) => (
                    <div key={f.key} className="grid gap-1.5">
                      <Label htmlFor={`${f.key}-${p.att.index}`}>{f.label}</Label>
                      <Input
                        id={`${f.key}-${p.att.index}`}
                        value={(collected[p.att.index]?.[f.key]) || ''}
                        onChange={(e) => setColl(p.att.index, f.key, maskFor(f.type, e.target.value))}
                        inputMode={f.type === 'text' ? undefined : 'numeric'}
                        placeholder={f.type === 'cpf' ? '000.000.000-00' : undefined}
                      />
                    </div>
                  ))}
                </div>
              )}

              {mode === 'DRAW' && (
                <div className="mt-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    Assinatura do responsável
                  </Label>
                  <SignaturePad
                    onChange={(dataUrl) => setSignatures((prev) => ({ ...prev, [p.att.index]: dataUrl }))}
                  />
                </div>
              )}

              <label className="mt-2 flex items-start gap-2 text-sm">
                <Checkbox
                  checked={!!accepted[p.att.index]}
                  onCheckedChange={(v) => setAccepted((prev) => ({ ...prev, [p.att.index]: v === true }))}
                />
                <span>Li e concordo com o termo de responsabilidade deste participante.</span>
              </label>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!allValid}>
            Confirmar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LiabilityTermDialog;
