import { describe, expect, it } from 'vitest';
import type { Order } from '../domain';
import { receiptRows } from './receiptImage';

const order: Order = {
  id: 'S-900',
  businessId: 'harbor',
  createdAt: '2026-11-16T05:30:00.000Z',
  service: 'Dine In',
  tableIds: ['T01'],
  status: 'Completed',
  lines: [
    {
      id: 'l1',
      menuId: 'm1',
      name: 'Kopi Susu',
      price: 36000,
      qty: 2,
      variations: [
        {
          groupId: 'size',
          groupName: 'Size',
          optionId: 'large',
          optionName: 'Large',
          priceDelta: 7000,
        },
      ],
      note: 'Less ice',
    },
    {
      id: 'l2',
      menuId: 'm2',
      name: 'Roti Bakar',
      price: 42000,
      qty: 1,
      modifier: 'Extra kaya',
    },
  ],
  subtotal: 114000,
  discount: 10000,
  tax: 10400,
  total: 114400,
  coupon: 'HEMAT10',
  payment: 'Cash',
  tendered: 120000,
  change: 5600,
  cashierName: 'Sari',
};

describe('receipt image rows', () => {
  it('includes tenant, order, line details, totals, payment, and change', () => {
    const rows = receiptRows(
      order,
      { name: 'Harbor Cafe', location: 'Kemang' },
      ['T01 Kemang']
    );
    expect(rows[0]).toEqual({
      kind: 'center',
      text: 'HARBOR CAFE',
      size: 'title',
      bold: true,
    });
    expect(rows).toContainEqual({
      kind: 'text',
      text: 'Table: T01 Kemang',
      size: 'small',
    });
    expect(rows).toContainEqual({
      kind: 'text',
      text: 'Cashier: Sari',
      size: 'small',
    });
    expect(rows).toContainEqual({
      kind: 'pair',
      left: '2 × Kopi Susu',
      right: expect.stringContaining('72.000'),
      size: 'body',
    });
    expect(rows).toContainEqual({
      kind: 'text',
      text: '+ Size: Large',
      size: 'small',
      indent: true,
    });
    expect(rows).toContainEqual({
      kind: 'text',
      text: 'Note: Less ice',
      size: 'small',
      indent: true,
    });
    expect(rows).toContainEqual({
      kind: 'text',
      text: 'Extra kaya',
      size: 'small',
      indent: true,
    });
    expect(rows).toContainEqual({
      kind: 'pair',
      left: 'Discount HEMAT10',
      right: expect.stringContaining('10.000'),
      size: 'body',
    });
    expect(rows).toContainEqual({
      kind: 'pair',
      left: 'TOTAL',
      right: expect.stringContaining('114.400'),
      size: 'total',
      bold: true,
    });
    expect(rows).toContainEqual({
      kind: 'pair',
      left: 'Cash',
      right: expect.stringContaining('120.000'),
      size: 'body',
    });
    expect(rows).toContainEqual({
      kind: 'pair',
      left: 'Change',
      right: expect.stringContaining('5.600'),
      size: 'body',
    });
    expect(rows.at(-1)).toEqual({
      kind: 'center',
      text: 'Thank you',
      size: 'body',
    });
  });
});
