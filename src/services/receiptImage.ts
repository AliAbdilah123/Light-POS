import { idr, localDateTime, type Order } from '../domain';

export type ReceiptBusiness = { name: string; location?: string };
export type ReceiptRow =
  | { kind: 'center'; text: string; size: 'title' | 'body' | 'small'; bold?: boolean }
  | { kind: 'text'; text: string; size: 'body' | 'small'; indent?: boolean }
  | { kind: 'pair'; left: string; right: string; size: 'body' | 'total'; bold?: boolean }
  | { kind: 'rule' };

const sizes = {
  80: { title: 34, body: 21, small: 17, total: 27, width: 576, pad: 28 },
  58: { title: 26, body: 16, small: 14, total: 21, width: 384, pad: 22 },
};
const money = (value: number) => idr(value).replace(/\u00a0/g, ' ');

export function receiptRows(
  order: Order,
  business: ReceiptBusiness,
  tables: string[]
): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    { kind: 'center', text: business.name.toUpperCase(), size: 'title', bold: true },
  ];
  if (business.location)
    rows.push({ kind: 'center', text: business.location, size: 'small' });
  rows.push({ kind: 'rule' });
  rows.push({
    kind: 'pair',
    left: `Receipt ${order.id}`,
    right: '',
    size: 'body',
    bold: true,
  });
  rows.push({
    kind: 'text',
    text: `${localDateTime(order.createdAt)} · ${order.service}`,
    size: 'small',
  });
  if (tables.length) rows.push({ kind: 'text', text: `Table: ${tables.join(', ')}`, size: 'small' });
  if (order.cashierName)
    rows.push({ kind: 'text', text: `Cashier: ${order.cashierName}`, size: 'small' });
  rows.push({ kind: 'rule' });
  for (const line of order.lines) {
    rows.push({
      kind: 'pair',
      left: `${line.qty} × ${line.name}`,
      right: money(line.price * line.qty),
      size: 'body',
    });
    for (const variation of line.variations || [])
      rows.push({
        kind: 'text',
        text: `+ ${variation.groupName}: ${variation.optionName}`,
        size: 'small',
        indent: true,
      });
    if (line.modifier)
      rows.push({ kind: 'text', text: line.modifier, size: 'small', indent: true });
    if (line.note)
      rows.push({ kind: 'text', text: `Note: ${line.note}`, size: 'small', indent: true });
  }
  rows.push({ kind: 'rule' });
  rows.push({ kind: 'pair', left: 'Subtotal', right: money(order.subtotal), size: 'body' });
  if (order.discount > 0)
    rows.push({
      kind: 'pair',
      left: `Discount${order.coupon ? ` ${order.coupon}` : ''}`,
      right: `−${money(order.discount)}`,
      size: 'body',
    });
  rows.push({ kind: 'pair', left: 'Tax', right: money(order.tax), size: 'body' });
  rows.push({
    kind: 'pair',
    left: 'TOTAL',
    right: money(order.total),
    size: 'total',
    bold: true,
  });
  if (order.payment)
    rows.push({
      kind: 'pair',
      left: order.payment,
      right: money(order.tendered ?? order.total),
      size: 'body',
    });
  if (order.change)
    rows.push({ kind: 'pair', left: 'Change', right: money(order.change), size: 'body' });
  rows.push({ kind: 'rule' });
  rows.push({ kind: 'center', text: 'Thank you', size: 'body' });
  return rows;
}

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (ctx.measureText(`${line} ${word}`).width <= maxWidth) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

export function receiptJpgDataUrl(
  order: Order,
  business: ReceiptBusiness,
  tables: string[],
  paperWidth: 58 | 80 = 80
): string {
  const size = sizes[paperWidth];
  const measureCanvas = document.createElement('canvas');
  const measure = measureCanvas.getContext('2d');
  if (!measure) throw Error('This browser cannot create a receipt image.');
  const font = (pixels: number, bold = false) =>
    `${bold ? '600' : '400'} ${pixels}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
  const innerWidth = size.width - size.pad * 2;
  const draws: {
    text: string;
    x: number;
    y: number;
    align: CanvasTextAlign;
    font: string;
    color: string;
  }[] = [];
  const rules: { y: number }[] = [];
  let cursor = size.pad;
  const addText = (
    text: string,
    pixels: number,
    bold: boolean,
    align: CanvasTextAlign,
    maxWidth = innerWidth,
    x = align === 'center' ? size.width / 2 : align === 'right' ? size.width - size.pad : size.pad,
    color = '#111111'
  ) => {
    measure.font = font(pixels, bold);
    for (const line of wrap(measure, text, maxWidth)) {
      draws.push({ text: line, x, y: cursor + pixels, align, font: font(pixels, bold), color });
      cursor += pixels * 1.35;
    }
  };
  const addPair = (left: string, right: string, pixels: number, bold: boolean) => {
    measure.font = font(pixels, bold);
    const rightWidth = right ? measure.measureText(right).width : 0;
    const lines = wrap(measure, left, innerWidth - rightWidth - 8);
    for (let index = 0; index < lines.length; index += 1) {
      draws.push({
        text: lines[index],
        x: size.pad,
        y: cursor + pixels,
        align: 'left',
        font: font(pixels, bold),
        color: '#111111',
      });
      if (index === lines.length - 1 && right)
        draws.push({
          text: right,
          x: size.width - size.pad,
          y: cursor + pixels,
          align: 'right',
          font: font(pixels, bold),
          color: '#111111',
        });
      cursor += pixels * 1.35;
    }
  };
  const addRule = () => {
    cursor += 8;
    rules.push({ y: cursor });
    cursor += 12;
  };
  for (const row of receiptRows(order, business, tables)) {
    if (row.kind === 'rule') {
      addRule();
      continue;
    }
    if (row.kind === 'center') {
      addText(row.text, size[row.size], !!row.bold, 'center');
      continue;
    }
    if (row.kind === 'pair') {
      addPair(row.left, row.right, size[row.size], !!row.bold);
      continue;
    }
    addText(
      row.text,
      size[row.size],
      false,
      'left',
      innerWidth - (row.indent ? 18 : 0),
      size.pad + (row.indent ? 18 : 0),
      row.size === 'small' ? '#4b5563' : '#111111'
    );
  }
  const height = Math.ceil(cursor + size.pad);
  const canvas = document.createElement('canvas');
  canvas.width = size.width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('This browser cannot create a receipt image.');
  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size.width, height);
  for (const rule of rules) {
    ctx.strokeStyle = '#c7cbd3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size.pad, rule.y);
    ctx.lineTo(size.width - size.pad, rule.y);
    ctx.stroke();
  }
  for (const draw of draws) {
    ctx.font = draw.font;
    ctx.fillStyle = draw.color;
    ctx.textAlign = draw.align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(draw.text, draw.x, draw.y);
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function downloadReceiptJpg(
  order: Order,
  business: ReceiptBusiness,
  tables: string[],
  paperWidth: 58 | 80 = 80
) {
  const url = receiptJpgDataUrl(order, business, tables, paperWidth);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${order.id}.jpg`;
  document.body.append(link);
  link.click();
  link.remove();
}
