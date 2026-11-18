import { API } from '../store';

export type PrintType = 'receipt' | 'kitchen';
export type PaperWidth = 58 | 80;
export type Printer = {
  id: string;
  name: string;
  host: string;
  port: number;
  paperWidth: PaperWidth;
  enabled: boolean;
  createdAt?: string;
};
export type PrinterDraft = Omit<Printer, 'id' | 'createdAt'>;
export type PrintSettings = {
  receiptPrinterId: string | null;
  kitchenPrinterId: string | null;
  autoPrintReceipt: boolean;
  autoPrintKitchen: boolean;
  receiptHeader: string;
  updatedAt?: string | null;
};
export type PrintResult = {
  printed: boolean;
  reason?: 'auto-disabled' | 'no-printer' | 'printer-disabled';
  printerId?: string;
  printerName?: string;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...options,
  });
  const body = await response.json().catch(() => ({
    error: 'The server returned an invalid response.',
  }));
  if (!response.ok) throw Error(body.error || 'Request failed.');
  return body as T;
};
const json = (body: unknown, csrfToken: string): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
  body: JSON.stringify(body),
});

export const getPrinting = (business: string) =>
  request<{ printers: Printer[]; settings: PrintSettings; paperWidths: number[] }>(
    `/printers?business=${encodeURIComponent(business)}`
  );

export const getReceiptHeader = (business: string) =>
  request<{ header: string }>(
    `/receipt-header?business=${encodeURIComponent(business)}`
  );

export const createPrinter = (
  business: string,
  draft: PrinterDraft,
  csrfToken: string
) =>
  request<{ printer: Printer }>(
    `/printers?business=${encodeURIComponent(business)}`,
    json(draft, csrfToken)
  );

export const updatePrinter = (
  id: string,
  draft: PrinterDraft,
  csrfToken: string
) =>
  request<{ printer: Printer }>(`/printers/${encodeURIComponent(id)}`, {
    ...json(draft, csrfToken),
    method: 'PUT',
  });

export const deletePrinter = (id: string, csrfToken: string) =>
  request<{ ok: true }>(`/printers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-csrf-token': csrfToken },
  });

export const testPrinter = (id: string, csrfToken: string) =>
  request<{ ok: true; printerName: string }>(
    `/printers/${encodeURIComponent(id)}/test`,
    { method: 'POST', headers: { 'x-csrf-token': csrfToken } }
  );

export const savePrintSettings = (
  business: string,
  settings: Omit<PrintSettings, 'updatedAt'>,
  csrfToken: string
) =>
  request<{ settings: PrintSettings }>(
    `/print-settings?business=${encodeURIComponent(business)}`,
    { ...json(settings, csrfToken), method: 'PUT' }
  );

export const printOrder = (
  business: string,
  orderId: string,
  type: PrintType,
  auto: boolean,
  csrfToken: string
) =>
  request<PrintResult>(
    `/print?business=${encodeURIComponent(business)}`,
    json({ orderId, type, auto }, csrfToken)
  );

export const printReason = (reason?: PrintResult['reason']) =>
  reason === 'auto-disabled'
    ? 'Automatic printing is off for this tenant.'
    : reason === 'no-printer'
    ? 'No printer is assigned for this job.'
    : reason === 'printer-disabled'
    ? 'The assigned printer is disabled.'
    : 'Nothing was printed.';
