import { createContext, useContext, useEffect, useState } from 'react';

export interface HeaderConfig {
  title?: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  hide?: boolean;
}

interface HeaderContextType {
  config: HeaderConfig;
  setConfig: (c: HeaderConfig) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>({});
  return (
    <HeaderContext.Provider value={{ config, setConfig }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader(config?: HeaderConfig) {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeader must be used within HeaderProvider');

  // quando chamado com config, aplica ao montar e limpa ao desmontar
  useEffect(() => {
    if (!config) return;
    ctx.setConfig(config);
    return () => ctx.setConfig({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { config: ctx.config, setConfig: ctx.setConfig };
}
