import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Home, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { consultarInscricao } from '@/lib/eventsApi';

export default function RegistrationSuccess() {
  const [, params] = useRoute('/inscricao/:orderCode');
  const [, setLocation] = useLocation();
  const orderCode = params?.orderCode;

  const [inscricao, setInscricao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (orderCode) {
      carregarInscricao();
    }
  }, [orderCode]);

  const carregarInscricao = async () => {
    try {
      setLoading(true);
      const data = await consultarInscricao(orderCode!);
      setInscricao(data);
    } catch (error) {
      console.error('Erro ao carregar inscrição:', error);
      toast.error('Erro ao carregar inscrição');
    } finally {
      setLoading(false);
    }
  };

  const copiarCodigo = () => {
    navigator.clipboard.writeText(orderCode!);
    setCopiado(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopiado(false), 2000);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-green-500',
      cancelled: 'bg-red-500',
      refunded: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!inscricao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm w-full space-y-4">
          <p className="font-medium text-slate-700">Inscrição não encontrada</p>
          <p className="text-sm text-slate-400">
            Não foi possível encontrar a inscrição com o código fornecido.
          </p>
          <Button onClick={() => setLocation('/')} className="w-full">
            <Home className="h-4 w-4 mr-2" />
            Voltar para eventos
          </Button>
        </div>
      </div>
    );
  }

  const isConfirmed = inscricao.paymentStatus === 'confirmed';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="container max-w-lg mx-auto space-y-5">

        {/* Status header */}
        <div
          className={`rounded-2xl p-8 text-center ${
            isConfirmed
              ? 'bg-gradient-to-b from-green-500 to-green-600 text-white'
              : 'bg-gradient-to-b from-amber-400 to-amber-500 text-white'
          }`}
        >
          <div className="flex justify-center mb-4">
            {isConfirmed ? (
              <CheckCircle2 className="h-16 w-16 text-white drop-shadow" />
            ) : (
              <Loader2 className="h-16 w-16 text-white animate-spin drop-shadow" />
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {isConfirmed ? 'Inscrição Confirmada!' : 'Inscrição Registrada'}
          </h1>
          <p className="text-sm mt-2 text-white/80">
            {isConfirmed
              ? 'Seu pagamento foi processado com sucesso'
              : 'Aguardando confirmação do pagamento'}
          </p>
        </div>

        {/* Código do pedido */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Código do pedido</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-mono font-bold text-slate-900">{orderCode}</span>
            <button
              type="button"
              onClick={copiarCodigo}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {copiado ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-slate-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Guarde este código para consultar sua inscrição</p>
        </div>

        {/* Detalhes */}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {inscricao.event?.title && (
            <div className="flex justify-between items-center px-5 py-3.5 text-sm">
              <span className="text-slate-500">Evento</span>
              <span className="font-medium text-slate-900 text-right max-w-[55%]">
                {inscricao.event.title}
              </span>
            </div>
          )}
          {inscricao.batch?.name && (
            <div className="flex justify-between items-center px-5 py-3.5 text-sm">
              <span className="text-slate-500">Lote</span>
              <span className="font-medium text-slate-900">{inscricao.batch.name}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-5 py-3.5 text-sm">
            <span className="text-slate-500">Quantidade</span>
            <span className="font-medium text-slate-900">{inscricao.quantity} inscrito(s)</span>
          </div>
          {inscricao.couponCode && (
            <div className="flex justify-between items-center px-5 py-3.5 text-sm">
              <span className="text-slate-500">Cupom</span>
              <Badge variant="secondary">{inscricao.couponCode}</Badge>
            </div>
          )}
          <div className="flex justify-between items-center px-5 py-3.5 text-sm">
            <span className="text-slate-500">Status</span>
            <Badge className={getStatusColor(inscricao.paymentStatus)}>
              {getStatusLabel(inscricao.paymentStatus)}
            </Badge>
          </div>
          <div className="flex justify-between items-center px-5 py-4 font-bold">
            <span className="text-slate-700">Total</span>
            <span className="text-lg text-primary">
              R$ {parseFloat(inscricao.finalPrice).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Próximos passos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Próximos passos</h4>
          <ul className="space-y-2">
            {(isConfirmed
              ? [
                  'Você receberá um e-mail de confirmação em breve',
                  'Guarde o código do pedido para consultas futuras',
                  'Apresente este código no dia do evento',
                ]
              : [
                  'Aguarde a confirmação do pagamento',
                  'Você receberá um e-mail assim que for confirmado',
                  'Use o código do pedido para consultar o status',
                ]
            ).map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span
                  className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isConfirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setLocation('/')} className="flex-1">
            <Home className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={() => window.print()} variant="secondary" className="flex-1">
            Imprimir
          </Button>
        </div>
      </div>
    </div>
  );
}
