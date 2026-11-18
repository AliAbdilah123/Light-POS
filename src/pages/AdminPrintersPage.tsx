import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Printer as PrinterIcon, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { businesses } from '../mockData';
import { calculateTotals, type Order } from '../domain';
import { downloadReceiptJpg, receiptRows } from '../services/receiptImage';
import {
  createPrinter,
  deletePrinter,
  getPrinting,
  savePrintSettings,
  testPrinter,
  updatePrinter,
  type PaperWidth,
  type Printer,
  type PrinterDraft,
  type PrintSettings,
} from '../services/printing';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { NativeSelect as Select } from '../components/ui/native-select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Metric, Modal, PageHead, SectionTitle } from '../components/molecules';

const defaults: PrintSettings = {
  receiptPrinterId: null,
  kitchenPrinterId: null,
  autoPrintReceipt: true,
  autoPrintKitchen: false,
  receiptHeader: '',
};
const emptyDraft = (paperWidth: PaperWidth = 80): PrinterDraft => ({
  name: '',
  host: '',
  port: 9100,
  paperWidth,
  enabled: true,
});

export function AdminPrintersPage() {
  const { business, user, data } = useStore();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [settings, setSettings] = useState<PrintSettings>(defaults);
  const [editing, setEditing] = useState<Printer>();
  const [draft, setDraft] = useState<PrinterDraft>();
  const [removing, setRemoving] = useState<Printer>();
  const [testing, setTesting] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selected = business !== 'all';
  const label = businesses.find((item) => item.id === business)?.name || business;
  const demoOrder = useMemo<Order>(() => {
    const menus = data.menus.filter((menu) => !menu.archived).slice(0, 2);
    const lines = (
      menus.length
        ? menus
        : [
            { id: 'demo-coffee', name: 'House coffee', price: 28000 },
            { id: 'demo-pastry', name: 'Butter pastry', price: 32000 },
          ]
    ).map((menu, index) => ({
      id: `demo-line-${index}`,
      menuId: menu.id,
      name: menu.name,
      price: menu.price,
      qty: index + 1,
    }));
    const totals = calculateTotals(lines);
    return {
      id: 'DEMO-0001',
      businessId: business,
      createdAt: new Date().toISOString(),
      service: 'Dine In',
      tableIds: data.tables.slice(0, 1).map((table) => table.id),
      status: 'Completed',
      lines,
      ...totals,
      payment: 'Cash',
      tendered: totals.total + 10000,
      change: 10000,
      cashierName: user.name,
    };
  }, [data.menus, data.tables, business, user.name]);
  const demoTables =
    demoOrder.tableIds?.map(
      (id) => data.tables.find((table) => table.id === id)?.name || id
    ) || [];
  const demoRows = receiptRows(
    demoOrder,
    {
      name: label,
      location: businesses.find((item) => item.id === business)?.location,
      header: settings.receiptHeader,
    },
    demoTables
  );

  const load = () => {
    if (!selected) {
      setPrinters([]);
      setSettings(defaults);
      return;
    }
    getPrinting(business)
      .then((result) => {
        setPrinters(result.printers);
        setSettings(result.settings);
        setError('');
      })
      .catch((reason) => setError(reason.message));
  };
  useEffect(load, [business, selected]);

  const openNew = () => {
    setEditing(undefined);
    setDraft(emptyDraft());
    setError('');
    setMessage('');
  };
  const openEdit = (printer: Printer) => {
    setEditing(printer);
    setDraft({
      name: printer.name,
      host: printer.host,
      port: printer.port,
      paperWidth: printer.paperWidth,
      enabled: printer.enabled,
    });
    setError('');
    setMessage('');
  };
  const closeForm = () => {
    setEditing(undefined);
    setDraft(undefined);
  };
  const savePrinter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim() || !draft.host.trim()) {
      setError('Printer name and host are required.');
      return;
    }
    try {
      if (editing)
        await updatePrinter(editing.id, draft, user.csrfToken);
      else await createPrinter(business, draft, user.csrfToken);
      setMessage(editing ? 'Printer updated.' : 'Printer added.');
      setError('');
      closeForm();
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Printer not saved.');
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      await deletePrinter(removing.id, user.csrfToken);
      setMessage(`${removing.name} removed.`);
      setError('');
      setRemoving(undefined);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Printer not removed.');
    }
  };
  const test = async (printer: Printer) => {
    setTesting(printer.id);
    setMessage('');
    setError('');
    try {
      const result = await testPrinter(printer.id, user.csrfToken);
      setMessage(`Test ticket sent to ${result.printerName}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Test print failed.');
    } finally {
      setTesting('');
    }
  };
  const saveSettings = async () => {
    try {
      const result = await savePrintSettings(
        business,
        {
          receiptPrinterId: settings.receiptPrinterId,
          kitchenPrinterId: settings.kitchenPrinterId,
          autoPrintReceipt: settings.autoPrintReceipt,
          autoPrintKitchen: settings.autoPrintKitchen,
          receiptHeader: settings.receiptHeader,
        },
        user.csrfToken
      );
      setSettings(result.settings);
      setMessage('Print routing saved.');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Settings not saved.');
    }
  };
  const saveDemoJpg = () => {
    try {
      downloadReceiptJpg(
        demoOrder,
        {
          name: label,
          location: businesses.find((item) => item.id === business)?.location,
          header: settings.receiptHeader,
        },
        demoTables
      );
      setMessage('Sample receipt JPG downloaded.');
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The sample receipt image could not be created.'
      );
    }
  };
  const printerName = (id: string | null) =>
    printers.find((printer) => printer.id === id)?.name || 'Not assigned';
  const columns: DataTableColumn<Printer>[] = [
    {
      key: 'name',
      label: 'Printer',
      value: (printer) => printer.name,
      render: (printer) => (
        <span>
          <strong>{printer.name}</strong>
          <br />
          <small>{printer.paperWidth} mm paper</small>
        </span>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      value: (printer) => `${printer.host}:${printer.port}`,
      render: (printer) => `${printer.host}:${printer.port}`,
    },
    {
      key: 'status',
      label: 'Status',
      value: (printer) => (printer.enabled ? 'Enabled' : 'Disabled'),
      render: (printer) => (
        <Badge tone={printer.enabled ? 'good' : 'bad'}>
          {printer.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="Administration"
        title="Printers & printing"
        description="Route receipts and kitchen tickets to network thermal printers."
      />
      {!selected && (
        <p className="alert" role="status">
          Select one tenant to configure its printers and automatic printing.
        </p>
      )}
      {error && (
        <p className="alert bad" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <div className="metric-grid">
        <Metric
          label="Printers"
          value={String(printers.length)}
          delta={`${printers.filter((printer) => printer.enabled).length} enabled`}
          icon={<PrinterIcon />}
        />
        <Metric
          label="Receipt auto-print"
          value={settings.autoPrintReceipt ? 'On' : 'Off'}
          delta={printerName(settings.receiptPrinterId)}
          icon={<ShieldCheck />}
        />
        <Metric
          label="Kitchen auto-print"
          value={settings.autoPrintKitchen ? 'On' : 'Off'}
          delta={printerName(settings.kitchenPrinterId)}
          icon={<ShieldCheck />}
        />
      </div>
      <div className="split wide-left">
        <Card>
          <SectionTitle
            title="Thermal printers"
            meta={selected ? `Scoped to ${label}` : 'Select one business'}
            action={
              <Button variant="primary" disabled={!selected} onClick={openNew}>
                <Plus /> Add printer
              </Button>
            }
          />
          <div className="printers-table">
            <DataTable
              ariaLabel="Printers"
              rows={printers}
              rowKey={(printer) => printer.id}
              columns={columns}
              empty="No printers configured for this tenant."
              rowActions={(printer) => (
                <div className="row-actions">
                  <Button
                    aria-label={`Edit ${printer.name}`}
                    onClick={() => openEdit(printer)}
                  >
                    Edit
                  </Button>
                  <Button
                    aria-label={`Test ${printer.name}`}
                    disabled={testing === printer.id}
                    onClick={() => void test(printer)}
                  >
                    {testing === printer.id ? 'Testing…' : 'Test'}
                  </Button>
                  <Button
                    aria-label={`Remove ${printer.name}`}
                    variant="danger"
                    onClick={() => setRemoving(printer)}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
              )}
            />
          </div>
        </Card>
        <Card>
          <SectionTitle title="Print routing" meta="Per tenant" />
          <p className="muted">
            Assign a printer to each job. Receipt printing starts on; kitchen
            ticket printing starts off. A printer can serve both jobs or you can
            use two different printers.
          </p>
          <Select
            label="Receipt printer"
            value={settings.receiptPrinterId || ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                receiptPrinterId: event.target.value || null,
              }))
            }
          >
            <option value="">Not assigned</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name}
                {printer.enabled ? '' : ' (disabled)'}
              </option>
            ))}
          </Select>
          <Select
            label="Kitchen printer"
            value={settings.kitchenPrinterId || ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                kitchenPrinterId: event.target.value || null,
              }))
            }
          >
            <option value="">Not assigned</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name}
                {printer.enabled ? '' : ' (disabled)'}
              </option>
            ))}
          </Select>
          <label className="field">
            <span>Receipt header phrase</span>
            <textarea
              value={settings.receiptHeader}
              maxLength={500}
              rows={3}
              placeholder="e.g. Jl. Kemang Raya No. 12, Jakarta"
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  receiptHeader: event.target.value,
                }))
              }
            />
          </label>
          <p className="hint-text">
            Centered under the tenant name on printed and JPG receipts. Line
            breaks are preserved.
          </p>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={settings.autoPrintReceipt}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  autoPrintReceipt: event.target.checked,
                }))
              }
            />
            Auto-print receipt after payment
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={settings.autoPrintKitchen}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  autoPrintKitchen: event.target.checked,
                }))
              }
            />
            Auto-print kitchen ticket when an order is sent to the kitchen
          </label>
          <div className="form-actions">
            <Button
              variant="primary"
              disabled={!selected}
              onClick={() => void saveSettings()}
            >
              Save print routing
            </Button>
          </div>
          <p className="definition">
            Automatic jobs still need an assigned, enabled printer. Manual print
            actions stay available from the order and kitchen screens.
          </p>
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="Receipt image demo"
          meta="JPG download"
          action={<Badge tone="info">Demo</Badge>}
        />
        <p className="muted">
          This sample uses the current tenant's menu and shows the receipt image
          layout. Download it as a JPG to verify the saved copy before service.
        </p>
        <div className="receipt-jpg-preview" aria-label="Sample receipt preview">
          {demoRows.map((row, index) =>
            row.kind === 'rule' ? (
              <hr key={index} />
            ) : row.kind === 'center' ? (
              <p key={index} className={`center ${row.size}`}>
                {row.text}
              </p>
            ) : row.kind === 'pair' ? (
              <p key={index} className={`pair ${row.size}`}>
                <span>{row.left}</span>
                <b>{row.right}</b>
              </p>
            ) : (
              <p
                key={index}
                className={`text ${row.size}${row.indent ? ' indent' : ''}`}
              >
                {row.text}
              </p>
            )
          )}
        </div>
        <div className="form-actions">
          <Button variant="primary" disabled={!selected} onClick={saveDemoJpg}>
            <Download /> Download sample JPG
          </Button>
        </div>
      </Card>
      {draft && (
        <Modal
          title={editing ? `Edit ${editing.name}` : 'Add thermal printer'}
          onClose={closeForm}
        >
          <form onSubmit={savePrinter}>
            <Input
              label="Printer name"
              value={draft.name}
              maxLength={60}
              required
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
            <Input
              label="Host or IP"
              value={draft.host}
              maxLength={253}
              placeholder="192.168.1.50"
              required
              onChange={(event) =>
                setDraft({ ...draft, host: event.target.value })
              }
            />
            <NumberInput
              label="Port"
              min={1}
              max={65535}
              value={draft.port}
              required
              onValueChange={(port) =>
                setDraft({ ...draft, port: port === '' ? 0 : port })
              }
            />
            <Select
              label="Paper width"
              value={String(draft.paperWidth)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  paperWidth: Number(event.target.value) as PaperWidth,
                })
              }
            >
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
            </Select>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft({ ...draft, enabled: event.target.checked })
                }
              />
              Enabled
            </label>
            <p className="hint-text">
              Network ESC/POS printers are addressed directly over TCP, usually
              port 9100.
            </p>
            <div className="form-actions">
              <Button type="button" onClick={closeForm}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save printer
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => setRemoving(undefined)}
        >
          <p>
            Receipt and kitchen routing that use this printer will be cleared.
            Automatic printing will skip until another printer is assigned.
          </p>
          <div className="form-actions">
            <Button onClick={() => setRemoving(undefined)}>Cancel</Button>
            <Button variant="danger" onClick={() => void remove()}>
              Remove printer
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
