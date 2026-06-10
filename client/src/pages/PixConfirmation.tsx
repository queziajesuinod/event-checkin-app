import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, QrCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PixConfirmation() {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  // Pegar dados da URL
  const searchParams = new URLSearchParams(window.location.search);
  const orderCode = searchParams.get('orderCode');
  const pixCode = searchParams.get('pixCode');
  const pixQrCodeBase64 = searchParams.get('qrCode');

  useEffect(() => {
    if (!orderCode || !pixCode) {
      setLocation('/');
    }
  }, [orderCode, pixCode, setLocation]);

  // Polling automático a cada 10 segundos
  useEffect(() => {
    if (!orderCode) return;

    const checkStatus = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';
        const response = await fetch(`${API_URL}/api/public/events/registrations/${orderCode}/status`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.isPaid) {
            toast.success('Pagamento confirmado!', {
              description: 'Redirecionando para o seu ticket...',
            });
            setTimeout(() => {
              setLocation(`/ticket/${orderCode}`);
            }, 1500);
          }
        }
      } catch (error) {
        // Silenciar erros de polling para não incomodar o usuário
        console.error('Erro no polling:', error);
      }
    };

    // Verificar imediatamente
    checkStatus();

    // Configurar polling a cada 10 segundos
    const intervalId = setInterval(checkStatus, 10000);

    // Limpar intervalo ao desmontar componente
    return () => clearInterval(intervalId);
  }, [orderCode, setLocation]);

  const copyToClipboard = async () => {
    if (!pixCode) return;
    
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success('Copiado!', {
        description: 'Código PIX copiado para a área de transferência',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro', {
        description: 'Não foi possível copiar o código',
      });
    }
  };

  const checkPaymentStatus = async () => {
    setChecking(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';
      const response = await fetch(`${API_URL}/api/public/events/registrations/${orderCode}/status`);
      
      if (!response.ok) {
        throw new Error('Não foi possível verificar o status');
      }
      
      const data = await response.json();
      
      if (data.isPaid) {
        toast.success('Pagamento confirmado!', {
          description: 'Redirecionando para o seu ticket...',
        });
        setTimeout(() => {
          setLocation(`/ticket/${orderCode}`);
        }, 1500);
      } else {
        toast.error('Pagamento pendente', {
          description: 'Ainda não identificamos o pagamento. Tente novamente em alguns instantes.',
        });
      }
    } catch (error) {
      toast.error('Erro', {
        description: 'Não foi possível verificar o status do pagamento',
      });
    } finally {
      setChecking(false);
    }
  };

  if (!orderCode || !pixCode) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="container max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="bg-gradient-to-b from-blue-500 to-blue-600 rounded-2xl p-8 text-center text-white">
          <QrCode className="h-12 w-12 mx-auto mb-3 drop-shadow" />
          <h1 className="text-2xl font-bold">Pagamento PIX</h1>
          <p className="text-sm mt-1 text-white/80">
            Código: <span className="font-mono font-semibold">{orderCode}</span>
          </p>
        </div>

        {/* Tabs PIX */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <Tabs defaultValue="qrcode" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-slate-100 h-12 bg-slate-50 p-0">
              <TabsTrigger
                value="qrcode"
                className="rounded-none h-full data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </TabsTrigger>
              <TabsTrigger
                value="copiacola"
                className="rounded-none h-full data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copia e Cola
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qrcode" className="p-6">
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-slate-500 text-center">
                  Escaneie com o app do seu banco
                </p>
                {pixQrCodeBase64 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <img
                      src={`data:image/png;base64,${pixQrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-56 h-56"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="copiacola" className="p-6 space-y-3">
              <p className="text-sm text-slate-500">
                Copie o código abaixo e cole no seu app bancário em PIX → Copia e Cola
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  value={pixCode}
                  className="w-full h-28 px-3 py-2.5 border border-slate-200 rounded-xl font-mono text-xs resize-none bg-slate-50 text-slate-700"
                />
                <Button
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2"
                  size="sm"
                  variant="outline"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Instruções */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Como pagar</h3>
          <ol className="space-y-2">
            {[
              'Abra o aplicativo do seu banco',
              'Escolha a opção PIX',
              'Escaneie o QR Code ou cole o código',
              'Confirme o pagamento',
              'Clique em "Já paguei" abaixo',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <Button onClick={checkPaymentStatus} className="w-full h-12 text-base font-semibold" disabled={checking}>
          {checking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            'Já paguei — Ver meu ticket'
          )}
        </Button>

        <p className="text-xs text-center text-slate-400">
          Após o pagamento, você será redirecionado automaticamente para a página do seu ticket
        </p>
      </div>
    </div>
  );
}
