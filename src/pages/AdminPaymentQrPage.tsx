import { useEffect, useState } from 'react';
import { QrCode, ShieldCheck, Trash2 } from 'lucide-react';
import { API, useStore } from '../store';
import { businesses } from '../mockData';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Metric, Modal, PageHead, SectionTitle } from '../components/molecules';

type Metadata = { configured: boolean; mime?: string; updatedAt?: string };
export function AdminPaymentQrPage() {
  const { business, user } = useStore(),
    [metadata, setMetadata] = useState<Metadata>({ configured: false }),
    [file, setFile] = useState<File>(),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [confirming, setConfirming] = useState<'replace' | 'remove'>();
  const selected = business !== 'all',
    label = businesses.find((item) => item.id === business)?.name || business;
  const load = () => {
    if (!selected) {
      setMetadata({ configured: false });
      return;
    }
    fetch(`${API}/payment-qr?business=${encodeURIComponent(business)}`, {
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error);
        setMetadata(body);
        setError('');
      })
      .catch((reason) => setError(reason.message));
  };
  useEffect(load, [business, selected]);
  const upload = async () => {
    if (!file) {
      setError('Choose a PNG, JPEG, or WebP image no larger than 2 MB.');
      return;
    }
    if (
      file.size > 2 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      setError('Choose a PNG, JPEG, or WebP image no larger than 2 MB.');
      return;
    }
    setConfirming(undefined);
    const response = await fetch(
        `${API}/payment-qr?business=${encodeURIComponent(business)}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: {
            'content-type': file.type,
            'x-csrf-token': user.csrfToken,
          },
          body: file,
        }
      ),
      body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setMetadata(body);
    setMessage('Payment QR saved.');
    setError('');
  };
  const remove = async () => {
    setConfirming(undefined);
    const response = await fetch(
        `${API}/payment-qr?business=${encodeURIComponent(business)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'x-csrf-token': user.csrfToken },
        }
      ),
      body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setMetadata(body);
    setMessage('Payment QR removed.');
    setError('');
  };
  return (
    <>
      <PageHead
        eyebrow="Administration"
        title="Payment QR"
        description="Upload the static QR image shown to cashiers during QRIS checkout."
      />
      {!selected && (
        <p className="alert" role="status">
          Select one tenant to configure its payment QR.
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
          label="QR status"
          value={metadata.configured ? 'Configured' : 'Not configured'}
          delta={metadata.configured ? 'QRIS checkout enabled' : 'QRIS fails closed'}
          icon={<ShieldCheck />}
        />
        <Metric
          label="Tenant"
          value={label}
          delta={selected ? 'Scoped to one business' : 'Select a business'}
          icon={<QrCode />}
        />
      </div>
      <div className="split wide-left">
        <Card>
          <SectionTitle
            title="Current QR"
            meta={metadata.configured ? 'Shown at QRIS checkout' : 'No image uploaded'}
            action={
              <Badge tone={metadata.configured ? 'good' : 'warn'}>
                {metadata.configured ? 'Configured' : 'Missing'}
              </Badge>
            }
          />
          {metadata.configured ? (
            <>
              <img
                className="payment-qr"
                src={`${API}/payment-qr/image?business=${encodeURIComponent(
                  business
                )}&v=${encodeURIComponent(metadata.updatedAt || '')}`}
                alt={`Payment QR for ${label}`}
              />
              <p>Updated {new Date(metadata.updatedAt!).toLocaleString()}</p>
            </>
          ) : (
            <p>No payment QR configured.</p>
          )}
          <label className="field">
            <span>QR image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!selected}
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </label>
          <p className="hint-text">
            PNG, JPEG or WebP · square image · max 2 MB. Shown to cashiers during
            QRIS checkout.
          </p>
          <div className="form-actions">
            <Button
              variant="primary"
              disabled={!selected}
              onClick={() => {
                if (file && metadata.configured) setConfirming('replace');
                else void upload();
              }}
            >
              {metadata.configured ? 'Replace QR' : 'Upload QR'}
            </Button>
            {metadata.configured && (
              <Button variant="danger" onClick={() => setConfirming('remove')}>
                <Trash2 /> Remove QR
              </Button>
            )}
          </div>
        </Card>
        <Card>
          <SectionTitle title="How it is used" />
          <p className="muted">
            Cashiers see this image only when a QRIS payment is selected. If no
            QR is configured, QRIS checkout is disabled and the sale must use
            cash.
          </p>
          <p className="definition">
            The image is stored per tenant. Replacing it takes effect
            immediately for every cashier in this business.
          </p>
        </Card>
      </div>
      {confirming && (
        <Modal
          title={
            confirming === 'replace'
              ? 'Replace the current payment QR?'
              : 'Remove this payment QR?'
          }
          onClose={() => setConfirming(undefined)}
        >
          <p>
            {confirming === 'replace'
              ? 'Cashiers will immediately see the new image at QRIS checkout.'
              : 'QRIS checkout will fail closed for this tenant until a new QR is uploaded.'}
          </p>
          <div className="form-actions">
            <Button onClick={() => setConfirming(undefined)}>Cancel</Button>
            <Button
              variant={confirming === 'remove' ? 'danger' : 'primary'}
              onClick={() => {
                if (confirming === 'replace') void upload();
                else void remove();
              }}
            >
              {confirming === 'replace' ? 'Replace QR' : 'Remove QR'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
