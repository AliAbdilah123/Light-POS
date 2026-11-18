import { useState } from 'react';
import { FlaskConical, Target } from 'lucide-react';
import {
  activateExperiment,
  calculateExperiment,
  finalizeExperiment,
  idr,
  type Experiment,
  type MenuItem,
} from '../domain';
import { useStore } from '../store';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { Metric, FormActions, Modal, PageHead } from '../components/molecules';

const cloneMenus = (menus: MenuItem[]) => structuredClone(menus);

export function ExperimentsPage() {
  const { data, update } = useStore();
  const [editing, setEditing] = useState<Experiment>();
  const [pending, setPending] = useState<{
    experiment: Experiment;
    kind: 'activate' | 'finalize' | 'archive';
  }>();
  const create = () =>
    setEditing({
      id: `experiment-${Date.now()}`,
      name: '',
      assumptions: '',
      menuDrafts: cloneMenus(data.menus),
      dailyTargets: {},
      status: 'draft',
    });
  const save = () => {
    if (!editing?.name.trim()) return;
    update((d) => ({
      ...d,
      experiments: [
        ...d.experiments.filter((x) => x.id !== editing.id),
        { ...editing, name: editing.name.trim() },
      ],
    }));
    setEditing(undefined);
  };
  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title="Experiments"
        description="Model scenario arithmetic from draft prices, recipes, and explicit assumptions."
        action={
          <Button variant="primary" onClick={create}>
            New experiment
          </Button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Experiments"
          value={String(data.experiments.length)}
          delta={`${data.experiments.filter((e) => e.status === 'active').length} active`}
          icon={<FlaskConical />}
        />
        <Metric
          label="Drafts"
          value={String(data.experiments.filter((e) => e.status === 'draft').length)}
          delta="Not yet live"
          icon={<Target />}
        />
      </div>
      {editing && (
        <Modal
          title={
            data.experiments.some((x) => x.id === editing.id)
              ? 'Edit experiment'
              : 'New experiment'
          }
          onClose={() => setEditing(undefined)}
        >
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input
              label="Experiment name"
              value={editing.name}
              required
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <label>
              Assumptions
              <textarea
                value={editing.assumptions}
                onChange={(e) =>
                  setEditing({ ...editing, assumptions: e.target.value })
                }
              />
            </label>
            <h3>Draft menu and daily targets</h3>
            {editing.menuDrafts.map((m, index) => {
              const v = m.versions!.find((x) => x.version === m.currentVersion)!;
              return (
                <div className="inline-form" key={m.id}>
                  <NumberInput
                    label={`${v.name} draft price`}
                    min={0}
                    value={v.price}
                    onValueChange={(price) => {
                      const menuDrafts = [...editing.menuDrafts];
                      menuDrafts[index] = {
                        ...m,
                        versions: m.versions!.map((x) =>
                          x.version === m.currentVersion
                            ? { ...x, price: price === '' ? 0 : price }
                            : x
                        ),
                      };
                      setEditing({ ...editing, menuDrafts });
                    }}
                  />
                  <NumberInput
                    label={`${v.name} daily target`}
                    min={0}
                    value={editing.dailyTargets[m.id] || 0}
                    onValueChange={(target) =>
                      setEditing({
                        ...editing,
                        dailyTargets: {
                          ...editing.dailyTargets,
                          [m.id]: target === '' ? 0 : target,
                        },
                      })
                    }
                  />
                </div>
              );
            })}
            <FormActions
              onCancel={() => setEditing(undefined)}
              submit="Save experiment"
            />
          </form>
        </Modal>
      )}
      {pending && (
        <Modal
          title={
            pending.kind === 'activate'
              ? 'Activate this experiment?'
              : pending.kind === 'finalize'
              ? 'Finalize and apply to the catalog?'
              : 'Archive this experiment?'
          }
          onClose={() => setPending(undefined)}
        >
          <p>
            {pending.kind === 'activate' &&
              `${pending.experiment.menuDrafts.length} draft menu items will replace the live catalogue for every cashier and display screen until you deactivate it.`}
            {pending.kind === 'finalize' &&
              'The draft prices and recipes will be written as a new catalogue version and the experiment will close.'}
            {pending.kind === 'archive' &&
              'The experiment is removed from this list. Catalogue prices are not changed.'}
          </p>
          <div className="form-actions">
            <Button onClick={() => setPending(undefined)}>Cancel</Button>
            <Button
              variant={pending.kind === 'archive' ? 'danger' : 'primary'}
              onClick={() => {
                const target = pending.experiment;
                if (pending.kind === 'activate')
                  update((d) => ({
                    ...d,
                    experiments: activateExperiment(d.experiments, target.id),
                  }));
                if (pending.kind === 'finalize')
                  update((d) => {
                    const result = finalizeExperiment(d.menus, target);
                    return {
                      ...d,
                      menus: result.menus,
                      experiments: d.experiments.map((x) =>
                        x.id === target.id ? result.experiment : x
                      ),
                    };
                  });
                if (pending.kind === 'archive')
                  update((d) => ({
                    ...d,
                    experiments: d.experiments.map((x) =>
                      x.id === target.id ? { ...x, status: 'archived' } : x
                    ),
                  }));
                setPending(undefined);
              }}
            >
              {pending.kind === 'activate'
                ? 'Activate now'
                : pending.kind === 'finalize'
                ? 'Finalize now'
                : 'Archive'}
            </Button>
          </div>
        </Modal>
      )}
      <div className="list-stack">
        {data.experiments.map((e) => {
          const projection = calculateExperiment(e);
          return (
            <article className="card" key={e.id}>
              <div className="section-title">
                <div>
                  <h2>{e.name}</h2>
                  <p>{e.assumptions || 'No assumptions recorded.'}</p>
                </div>
                <Badge>{e.status}</Badge>
              </div>
              <p>
                <strong>Projected daily revenue: {idr(projection.projectedRevenue)}</strong>
              </p>
              <h3>Projected ingredient purchasing</h3>
              {projection.projectedIngredients.length ? (
                <ul>
                  {projection.projectedIngredients
                    .filter((i) => i.quantity > 0 || i.missing)
                    .map((i, n) => (
                      <li key={`${i.name}-${i.unit}-${n}`}>
                        {i.name}: {i.quantity}
                        {i.unit ? ` ${i.unit}` : ''}
                        {i.missing && (
                          <strong className="alert bad"> Missing {i.missing}</strong>
                        )}
                      </li>
                    ))}
                </ul>
              ) : (
                <p>No recipe quantities to project.</p>
              )}
              <div className="actions">
                {e.status === 'draft' && (
                  <>
                    <Button onClick={() => setEditing(structuredClone(e))}>
                      Edit
                    </Button>
                    <Button
                      onClick={() => setPending({ experiment: e, kind: 'activate' })}
                    >
                      Activate
                    </Button>
                  </>
                )}
                {e.status === 'active' && (
                  <Button
                    variant="primary"
                    onClick={() => setPending({ experiment: e, kind: 'finalize' })}
                  >
                    Finalize
                  </Button>
                )}
                {(e.status === 'draft' || e.status === 'active') && (
                  <Button
                    onClick={() => setPending({ experiment: e, kind: 'archive' })}
                  >
                    Archive
                  </Button>
                )}
              </div>
              {e.finalizedAt && (
                <small>Finalized {new Date(e.finalizedAt).toLocaleString()}</small>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
