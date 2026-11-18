import net from 'node:net';

export const PRINT_TYPES = new Set(['receipt', 'kitchen']);
export const PAPER_WIDTHS = new Set([58, 80]);

const ESC = '\x1b';
const GS = '\x1d';
const INIT = `${ESC}@${ESC}t\x10`;
const CENTER = `${ESC}a\x01`;
const LEFT = `${ESC}a\x00`;
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;
const DOUBLE = `${ESC}!\x30`;
const NORMAL = `${ESC}!\x00`;
const CUT = `${GS}V\x42\x00`;

const columns = (paperWidth) => (paperWidth === 58 ? 32 : 48);
const clean = (value) =>
  String(value ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/·/g, '-')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?');
const money = (value) =>
  `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
    Math.round(Number(value) || 0)
  )}`;
const dateTime = (value) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
const rule = (width) => '-'.repeat(width);
const wrap = (value, width) => {
  const words = clean(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > width) {
      if (line) {
        lines.push(line);
        line = '';
      }
      for (let index = 0; index < word.length; index += width)
        lines.push(word.slice(index, index + width));
      continue;
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};
const row = (left, right, width) => {
  const value = clean(right);
  const lines = wrap(left, width);
  const last = lines.pop();
  if (last.length + value.length + 1 <= width)
    lines.push(last + ' '.repeat(width - last.length - value.length) + value);
  else {
    lines.push(last);
    lines.push(' '.repeat(Math.max(0, width - value.length)) + value);
  }
  return lines.join('\n');
};
const lineDetails = (line) => {
  const details = [];
  for (const variation of line.variations || [])
    details.push(`+ ${variation.groupName}: ${variation.optionName}`);
  if (line.modifier) details.push(line.modifier);
  if (line.note) details.push(`Note: ${line.note}`);
  return details;
};
const wrappedDetails = (line, width) =>
  lineDetails(line).flatMap((detail) =>
    wrap(detail, width - 2).map((text) => `  ${text}`)
  );

export function renderReceipt({ order, business, tables, paperWidth = 80, header = '' }) {
  const width = columns(paperWidth);
  const out = [INIT, CENTER, DOUBLE, clean(business.name.toUpperCase()), NORMAL];
  if (business.location) out.push(clean(business.location));
  if (header)
    for (const line of String(header).split('\n'))
      for (const text of wrap(line, width)) out.push(clean(text));
  out.push(LEFT, rule(width));
  out.push(`${BOLD_ON}Receipt ${clean(order.id)}${BOLD_OFF}`);
  out.push(`${dateTime(order.createdAt)}  ${clean(order.service)}`);
  if (tables) out.push(`Table: ${clean(tables)}`);
  if (order.cashierName) out.push(`Cashier: ${clean(order.cashierName)}`);
  out.push(rule(width));
  for (const line of order.lines) {
    out.push(row(`${line.qty} x ${line.name}`, money(line.price * line.qty), width));
    out.push(...wrappedDetails(line, width));
  }
  out.push(rule(width));
  out.push(row('Subtotal', money(order.subtotal), width));
  if (order.discount > 0)
    out.push(
      row(
        `Discount${order.coupon ? ` ${order.coupon}` : ''}`,
        `-${money(order.discount)}`,
        width
      )
    );
  out.push(row('Tax', money(order.tax), width));
  out.push(`${BOLD_ON}${row('TOTAL', money(order.total), width)}${BOLD_OFF}`);
  if (order.payment)
    out.push(row(order.payment, money(order.tendered ?? order.total), width));
  if (order.change) out.push(row('Change', money(order.change), width));
  out.push(rule(width), CENTER, 'Thank you', LEFT, '\n\n\n', CUT);
  return Buffer.from(out.join('\n'), 'latin1');
}

export function renderKitchenTicket({ order, business, tables, paperWidth = 80 }) {
  const width = columns(paperWidth);
  const out = [INIT, CENTER, DOUBLE, clean(business.name.toUpperCase()), NORMAL];
  out.push(`${BOLD_ON}KITCHEN ORDER${BOLD_OFF}`, LEFT, rule(width));
  out.push(DOUBLE, clean(order.id), NORMAL);
  out.push(`${dateTime(order.createdAt)}  ${clean(order.service)}`);
  if (tables) out.push(`Table: ${clean(tables)}`);
  out.push(rule(width));
  for (const line of order.lines) {
    for (const text of wrap(`${line.qty} x ${line.name}`, width))
      out.push(`${BOLD_ON}${text}${BOLD_OFF}`);
    out.push(...wrappedDetails(line, width));
  }
  out.push(rule(width), CENTER, 'Kitchen copy', LEFT, '\n\n\n', CUT);
  return Buffer.from(out.join('\n'), 'latin1');
}

export function renderTestTicket({ business, printer, paperWidth = 80 }) {
  const width = columns(paperWidth);
  const out = [INIT, CENTER, DOUBLE, clean(business.name.toUpperCase()), NORMAL];
  out.push(`${BOLD_ON}PRINTER TEST${BOLD_OFF}`, LEFT, rule(width));
  out.push(`Printer: ${clean(printer.name)}`);
  out.push(`Address: ${clean(printer.host)}:${printer.port}`);
  out.push(`Paper: ${paperWidth}mm`);
  out.push(dateTime(new Date()));
  out.push(rule(width), CENTER, 'If you can read this, printing works.', LEFT);
  out.push('\n\n\n', CUT);
  return Buffer.from(out.join('\n'), 'latin1');
}

export function renderPrintJob({ type, order, business, tables, paperWidth, printer, header }) {
  if (type === 'receipt')
    return renderReceipt({ order, business, tables, paperWidth, header });
  if (type === 'kitchen')
    return renderKitchenTicket({ order, business, tables, paperWidth });
  if (type === 'test')
    return renderTestTicket({ business, printer, paperWidth });
  throw Error('Unknown print job type.');
}

export function sendToPrinter(printer, bytes, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: printer.host, port: printer.port });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(timeoutMs, () =>
      fail(Error(`Printer ${printer.name} timed out.`))
    );
    socket.once('error', (error) =>
      fail(Error(`Printer ${printer.name} is unreachable: ${error.message}`))
    );
    socket.once('connect', () =>
      socket.end(bytes, () => {
        if (settled) return;
        settled = true;
        resolve();
      })
    );
  });
}
