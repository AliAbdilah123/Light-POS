import { useCallback, useEffect, useState } from 'react';
import { API } from '../store';

export type MenuImageRecord = { menuId: string; updatedAt: string };

export const menuImageUrl = (
  business: string,
  menuId: string,
  version?: string
) =>
  `${API}/menu-image?business=${encodeURIComponent(
    business
  )}&menuId=${encodeURIComponent(menuId)}${
    version ? `&v=${encodeURIComponent(version)}` : ''
  }`;

const read = async (response: Response, fallback: string) => {
  const body = await response
    .json()
    .catch(() => ({ error: 'Invalid server response.' }));
  if (!response.ok) throw Error(body.error || fallback);
  return body;
};

export async function listMenuImages(
  business: string
): Promise<MenuImageRecord[]> {
  const response = await fetch(
    `${API}/menu-images?business=${encodeURIComponent(business)}`,
    { credentials: 'same-origin' }
  );
  const body = await read(response, 'Menu photos could not be loaded.');
  return body.images;
}

export async function uploadMenuImage(
  business: string,
  menuId: string,
  file: File,
  csrfToken: string
): Promise<MenuImageRecord> {
  const response = await fetch(menuImageUrl(business, menuId), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': file.type, 'x-csrf-token': csrfToken },
    body: file,
  });
  return read(response, 'Menu photo could not be saved.');
}

export async function deleteMenuImage(
  business: string,
  menuId: string,
  csrfToken: string
): Promise<void> {
  const response = await fetch(menuImageUrl(business, menuId), {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  await read(response, 'Menu photo could not be removed.');
}

/** Menu id → image version, so callers can render photos without extra requests. */
export function useMenuImages(business: string) {
  const [images, setImages] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    if (!business || business === 'all') {
      setImages({});
      return;
    }
    listMenuImages(business)
      .then((rows) =>
        setImages(
          Object.fromEntries(rows.map((row) => [row.menuId, row.updatedAt]))
        )
      )
      .catch(() => setImages({}));
  }, [business]);
  useEffect(load, [load]);
  return { images, reload: load };
}
