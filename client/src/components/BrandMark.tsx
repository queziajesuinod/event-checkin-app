import { useState } from 'react';

const LOGO = 'https://images.squarespace-cdn.com/content/v1/5bc9186e34c4e27773d92870/1546175613378-UHI78Z3KGSEOFFJEAP0B/logo-site.png';

/** Keep the brand legible when the external logo is unavailable offline. */
export function BrandMark({ className = '' }: { className?: string }) {
  const [unavailable, setUnavailable] = useState(false);
  return unavailable ? (
    <span className={`portal-wordmark ${className}`} aria-label="IECG">IECG<span>Comunidade Global</span></span>
  ) : (
    <img src={LOGO} alt="IECG" className={className} onError={() => setUnavailable(true)} />
  );
}
