import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getUserIdFromToken } from '@/lib/jwt';
import {
  Camera, Upload, X, Eye, EyeOff, ChevronLeft,
  Save, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

const C = {
  navy: '#0A1F3F',
  blue: '#1B4D8E',
  gold: '#C9A84C',
  surface: '#F0F2F5',
  white: '#FFFFFF',
};

/* ── Campo de texto genérico ── */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  right,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  right?: React.ReactNode;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full h-11 px-3 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            backgroundColor: '#F8F9FA',
            border: '1.5px solid #E5E7EB',
            color: C.navy,
            paddingRight: right ? '2.75rem' : undefined,
          }}
          onFocus={(e) => (e.currentTarget.style.border = `1.5px solid ${C.gold}`)}
          onBlur={(e) => (e.currentTarget.style.border = '1.5px solid #E5E7EB')}
        />
        {right && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>
        )}
      </div>
    </div>
  );
}

/* ── Seção card ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: C.white, boxShadow: '0 2px 12px rgba(10,31,63,0.08)' }}
    >
      <div className="h-1" style={{ backgroundColor: C.blue }} />
      <div className="p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.blue }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function Profile({ onClose }: { onClose?: () => void }) {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  /* ── form fields ── */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── avatar ── */
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── câmera ── */
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── estado ── */
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  /* ── ID: tenta token primeiro, cai no user.id do contexto ── */
  const userId = (user?.accessToken ? getUserIdFromToken(user.accessToken) : null) ?? user?.id ?? null;

  /* ── inicializa: dados do context + busca perfil no servidor ── */
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
      return;
    }
    if (!user || !userId) return;

    // preenche imediatamente com o que já temos
    setName(user.name ?? '');
    setEmail(user.email ?? '');

    if ((user as any).image) setAvatarPreview((user as any).image);

    // busca perfil completo usando o ID do token
    api.get(`/users/${userId}`)
      .then(({ data }) => {
        if (data.name)  setName(data.name);
        if (data.image) setAvatarPreview(data.image);
      })
      .catch(() => { /* silencia — usa dados do context */ });
  }, [authLoading, user, userId]);

  /* ── câmera: abrir ── */
  const openCamera = async () => {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Não foi possível acessar a câmera.' });
      setCameraOpen(false);
    }
  };

  /* ── câmera: fechar ── */
  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  /* ── câmera: capturar frame ── */
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setAvatarPreview(dataUrl);
    setAvatarBase64(dataUrl);
    closeCamera();
  };

  /* ── upload de arquivo ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarBase64(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── salvar ── */
  const handleSave = async () => {
    if (!userId) {
      setFeedback({ type: 'error', msg: 'Não foi possível identificar o usuário. Faça login novamente.' });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setFeedback({ type: 'error', msg: 'As senhas novas não coincidem.' });
      return;
    }

    setFeedback(null);
    setIsSaving(true);

    const payload: Record<string, any> = { name, email };
    if (avatarBase64) payload.image = avatarBase64;
    if (newPassword) {
      payload.password = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      await api.put(`/users/${userId}`, payload);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', msg: 'Perfil atualizado com sucesso!' });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        'Erro ao salvar. Tente novamente.';
      setFeedback({ type: 'error', msg });
    } finally {
      setIsSaving(false);
    }
  };

  const initial = (name || 'U')[0].toUpperCase();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.surface }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.blue }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.surface }}>

      {/* ── Header ── */}
      <header className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: C.navy }}>
        <button
          onClick={() => onClose ? onClose() : setLocation('/home')}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          {onClose
            ? <X className="w-4 h-4 text-white" />
            : <ChevronLeft className="w-4 h-4 text-white" />}
        </button>
        <h1 className="text-white font-bold text-base flex-1">Meu Perfil</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: C.gold, color: C.navy }}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar
        </button>
      </header>

      {/* ── Conteúdo ── */}
      <main className="flex-1 px-4 py-6 space-y-4 w-full max-w-md mx-auto pb-10">

        {/* Feedback */}
        {feedback && (
          <div
            className="flex items-start gap-2.5 px-4 py-3 rounded-2xl text-sm animate-in fade-in duration-300"
            style={{
              backgroundColor: feedback.type === 'success'
                ? 'rgba(34,197,94,0.12)'
                : 'rgba(220,38,38,0.12)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}
          >
            {feedback.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#22C55E' }} />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F87171' }} />}
            <p style={{ color: feedback.type === 'success' ? '#16A34A' : '#F87171' }}>
              {feedback.msg}
            </p>
          </div>
        )}

        {/* ── Avatar ── */}
        <Section title="Foto de Perfil">
          <div className="flex flex-col items-center gap-4">
            {/* Preview */}
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: C.gold, border: `3px solid ${C.blue}` }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-extrabold text-white">{initial}</span>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={openCamera}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: '#EBF2FB',
                  color: C.blue,
                  border: `1.5px solid ${C.blue}20`,
                }}
              >
                <Camera className="w-4 h-4" />
                Câmera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: '#EBF2FB',
                  color: C.blue,
                  border: `1.5px solid ${C.blue}20`,
                }}
              >
                <Upload className="w-4 h-4" />
                Galeria
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => { setAvatarPreview(null); setAvatarBase64(null); }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
                  style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#DC2626' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </Section>

        {/* ── Dados ── */}
        <Section title="Dados da Conta">
          <Field label="Nome completo" value={name} onChange={setName} placeholder="Seu nome" autoComplete="name" />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
              E-mail
            </label>
            <div
              className="w-full h-11 px-3 rounded-xl text-sm flex items-center gap-2 select-none"
              style={{
                backgroundColor: '#F0F2F5',
                border: '1.5px solid #E5E7EB',
                color: '#9CA3AF',
                cursor: 'not-allowed',
              }}
            >
              <span className="truncate">{email}</span>
              <span
                className="ml-auto text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#E5E7EB', color: '#9CA3AF' }}
              >
                bloqueado
              </span>
            </div>
          </div>
        </Section>

        {/* ── Senha ── */}
        <Section title="Alterar Senha">
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            Deixe em branco para não alterar a senha.
          </p>
          <Field
            label="Senha atual"
            value={currentPassword}
            onChange={setCurrentPassword}
            type={showCurrent ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            right={
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Field
            label="Nova senha"
            value={newPassword}
            onChange={setNewPassword}
            type={showNew ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            right={
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Field
            label="Confirmar nova senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            right={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
        </Section>
      </main>

      {/* ── Modal câmera ── */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ backgroundColor: 'rgba(10,31,63,0.95)' }}
        >
          <div className="w-full max-w-sm px-4 space-y-4">
            {/* Fechar */}
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Tirar foto</h2>
              <button
                onClick={closeCamera}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Vídeo */}
            <div className="rounded-2xl overflow-hidden aspect-video w-full bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            </div>

            {/* Canvas oculto para captura */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Botão capturar */}
            <button
              onClick={capturePhoto}
              className="w-full h-12 rounded-2xl font-bold text-base transition-all active:scale-95"
              style={{ backgroundColor: C.gold, color: C.navy }}
            >
              <Camera className="inline w-5 h-5 mr-2 -mt-0.5" />
              Capturar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
