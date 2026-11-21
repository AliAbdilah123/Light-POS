import type { ReactNode } from 'react';
import { menuImageUrl } from '../services/menuImages';

export function MenuImage({
  business,
  menuId,
  version,
  className,
  fallback,
}: {
  business: string;
  menuId: string;
  version?: string;
  className: string;
  fallback?: ReactNode;
}) {
  if (!version) return <>{fallback ?? null}</>;
  return (
    <img
      className={className}
      src={menuImageUrl(business, menuId, version)}
      alt=""
      loading="lazy"
    />
  );
}
