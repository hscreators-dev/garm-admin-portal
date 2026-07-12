import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useRole } from '../components/RoleContext';
import { useUsers } from '../api/useUsers';
import { api, type ApiUser, type TrackStage, type FeatureToggle, type CompanySettings, type CoordinatorSettings, type OrderFormConfig, type ServiceFeeConfig } from '../api/client';

const SERVICE_FEE_FIELDS: { key: keyof ServiceFeeConfig; label: string }[] = [
  { key: 'b2cPercent', label: 'Individuals — service fee (%)' },
  { key: 'b2cPerPiece', label: 'Individuals — per piece (₹/pc)' },
  { key: 'b2bPercent', label: 'Organisations — service fee (%)' },
  { key: 'bulkQtyThreshold', label: 'Bulk order threshold (pieces)' },
  { key: 'bulkPercent', label: 'Bulk orders — service fee (%)' },
  { key: 'minFee', label: 'Minimum fee (₹, small orders)' },
  { key: 'surplusDiscountPercent', label: 'Surplus fabric discount (%)' },
  { key: 'orgAdvancePercent', label: 'Organisations — advance before production (%)' },
];

const ROLE_OPTIONS = ['Super Admin', 'Operations Manager', 'QC Supervisor', 'Finance Manager', 'Warehouse Manager', 'View-Only'];

const TABS = ['Users', 'Roles & Permissions', 'Feature Toggles', 'Company Details', 'Procurement Manager', 'Order Form', 'Order Tracking'];

// Sections of the Garm App's custom order flow — each can be switched off
// here and disappears from the app instantly.
const ORDER_FORM_TOGGLES: { key: keyof OrderFormConfig; name: string; desc: string }[] = [
  { key: 'style', name: 'Style options', desc: 'Per-garment style choice (round neck, collared, formal…) on the garment cards' },
  { key: 'materials', name: 'Materials step', desc: 'Fabric type, GSM weight and weave selection per garment' },
  { key: 'sizes', name: 'Sizes step', desc: 'Per-size quantity breakdown (S/M/L/XL…) for each selected garment' },
  { key: 'referenceUpload', name: 'References & samples step', desc: 'Logo / design upload and sample options before review' },
  { key: 'livePreview', name: 'Live preview', desc: 'Live garment mockup shown while the customer adds their design' },
];

function relLogin(iso: string | null) {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const ROLE_PERMS = [
  { role: 'Super Admin', view: true, create: true, edit: true, del: true, print: true, exp: true },
  { role: 'Operations Manager', view: true, create: true, edit: true, del: false, print: true, exp: true },
  { role: 'QC Supervisor', view: true, create: true, edit: true, del: false, print: true, exp: false },
  { role: 'Finance Manager', view: true, create: true, edit: true, del: false, print: true, exp: true },
  { role: 'Warehouse Manager', view: true, create: false, edit: false, del: false, print: true, exp: false },
  { role: 'View-Only', view: true, create: false, edit: false, del: false, print: false, exp: false },
];

const COMPANY_FIELD_DEFS: { key: keyof CompanySettings; label: string; type?: string }[] = [
  { key: 'gstNumber', label: 'Company GST Number' },
  { key: 'placeOfSupply', label: 'Place of Supply' },
  { key: 'bankAccountHolder', label: 'Bank Account Holder' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'smtpEmail', label: 'SMTP Email' },
  { key: 'paymentGatewayKey', label: 'Stripe / Razorpay API Key', type: 'password' },
  { key: 'paymentTerms', label: 'Default Payment Terms' },
];

export default function Settings() {
  const showToast = useToast();
  const { currentUser } = useRole();
  const { users, loading: usersLoading } = useUsers();
  const [tab, setTab] = useState(0);
  const [addUserModal, setAddUserModal] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [coordinator, setCoordinator] = useState<CoordinatorSettings | null>(null);
  const [savingCoordinator, setSavingCoordinator] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderFormConfig | null>(null);
  const [serviceFee, setServiceFee] = useState<ServiceFeeConfig | null>(null);
  const [savingFee, setSavingFee] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'View-Only' });
  const [trackStages, setTrackStages] = useState<TrackStage[]>([]);
  const [trackStagesLoading, setTrackStagesLoading] = useState(true);
  const [savingStages, setSavingStages] = useState(false);

  useEffect(() => {
    api.getTrackStages().then(setTrackStages).finally(() => setTrackStagesLoading(false));
    api.getSettings().then((s) => {
      setFeatures(s.features);
      setCompany(s.company);
      setCoordinator(s.coordinator);
      setOrderForm(s.orderForm);
      setServiceFee(s.serviceFee);
    }).finally(() => {
      setFeaturesLoading(false);
      setCompanyLoading(false);
    });
  }, []);

  async function toggleFeature(f: FeatureToggle) {
    const next = !f.on;
    setFeatures((fs) => fs.map((x) => (x.key === f.key ? { ...x, on: next } : x)));
    try {
      const updated = await api.toggleFeature(f.key, next);
      setFeatures(updated);
      showToast(`${f.name} ${next ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setFeatures((fs) => fs.map((x) => (x.key === f.key ? { ...x, on: !next } : x))); // revert on failure
      showToast(`Couldn't update ${f.name}: ${(err as Error).message}`);
    }
  }

  async function saveCompanyDetails() {
    if (!company) return;
    setSavingCompany(true);
    try {
      const saved = await api.updateCompanySettings(company);
      setCompany(saved);
      showToast('Company settings saved.');
    } catch (err) {
      showToast(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveCoordinator() {
    if (!coordinator) return;
    setSavingCoordinator(true);
    try {
      const saved = await api.updateCoordinator(coordinator);
      setCoordinator(saved);
      showToast('Procurement manager details saved — the Garm App shows these immediately.');
    } catch (err) {
      showToast(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setSavingCoordinator(false);
    }
  }

  async function toggleOrderForm(key: keyof OrderFormConfig) {
    if (!orderForm) return;
    const next = !orderForm[key];
    setOrderForm({ ...orderForm, [key]: next });
    try {
      const saved = await api.updateOrderForm({ [key]: next });
      setOrderForm(saved);
      showToast(`${ORDER_FORM_TOGGLES.find((t) => t.key === key)?.name} ${next ? 'enabled' : 'hidden'} — the Garm App order flow updates immediately.`);
    } catch (err) {
      setOrderForm({ ...orderForm, [key]: !next }); // revert
      showToast(`Couldn't save: ${(err as Error).message}`);
    }
  }

  function updateStageField(key: string, field: 'label' | 'sub', value: string) {
    setTrackStages((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }
  async function saveTrackStages() {
    setSavingStages(true);
    try {
      const updated = await api.updateTrackStages(trackStages.map(({ key, label, sub }) => ({ key, label, sub })));
      setTrackStages(updated);
      showToast('Order tracking stages saved — the Garm App now shows this wording.');
    } catch (err) {
      showToast(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setSavingStages(false);
    }
  }

  async function submitAddUser() {
    if (!newUser.email.trim()) { showToast('Email is required'); return; }
    try {
      const created = await api.createUser({ name: newUser.name || newUser.email, email: newUser.email, role: newUser.role, status: 'Active' });
      showToast(`${created.name} added as ${created.role}. They can sign in immediately with ${created.email}.`);
      setNewUser({ name: '', email: '', role: 'View-Only' });
      setAddUserModal(false);
    } catch (err) {
      showToast(`Couldn't add user: ${(err as Error).message}`);
    }
  }

  async function submitEditUser() {
    if (!editUser) return;
    try {
      await api.updateUser(editUser.id, { name: editUser.name, role: editUser.role, status: editUser.status });
      showToast(`${editUser.name}'s access updated.`);
      setEditUser(null);
    } catch (err) {
      showToast(`Couldn't update user: ${(err as Error).message}`);
    }
  }

  async function toggleStatus(u: ApiUser) {
    if (u.email === currentUser?.email) { showToast("You can't disable your own account."); return; }
    const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
    await api.updateUser(u.id, { status: nextStatus });
    showToast(`${u.name} is now ${nextStatus.toLowerCase()}.`);
  }

  return (
    <div>
      <div className="page-head"><div><div className="page-title">Settings</div><div className="page-desc">Users, permissions, features and company configuration.</div></div></div>
      <div className="tabs">
        {TABS.map((t, i) => <div className={`tab ${tab === i ? 'active' : ''}`} key={t} onClick={() => setTab(i)}>{t}</div>)}
      </div>

      {tab === 0 && (
        <div>
          <div className="small-muted" style={{ marginBottom: 12 }}>
            Access is granted by email. Each person only sees the modules their role allows — Super Admins see everything.
          </div>
          <div className="page-actions" style={{ justifyContent: 'flex-end', display: 'flex', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAddUserModal(true)}><Icon name="plus" /> Add User</button>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {usersLoading && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Loading users…</td></tr>}
                {!usersLoading && users.map((u) => (
                  <tr key={u.email}>
                    <td className="cust-name">{u.name}</td><td>{u.email}</td><td><span className="tag">{u.role}</span></td>
                    <td><span className={`badge ${u.status === 'Active' ? 'tone-success' : u.status === 'Invited' ? 'tone-info' : 'tone-slate'}`}>{u.status}</span></td>
                    <td>{relLogin(u.lastLogin)}</td>
                    <td className="row-actions">
                      <button className="icon-btn btn-sm" style={{ width: 36, height: 36 }} onClick={() => setEditUser(u)}><Icon name="edit" /></button>
                      <button
                        className="icon-btn btn-sm"
                        style={{ width: 36, height: 36 }}
                        title={u.status === 'Active' ? 'Disable access' : 'Re-activate'}
                        onClick={() => toggleStatus(u)}
                      >
                        <Icon name={u.status === 'Active' ? 'xCircle' : 'checkCircle'} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Role</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th><th>Print</th><th>Export</th></tr></thead>
            <tbody>
              {ROLE_PERMS.map((r) => (
                <tr key={r.role}>
                  <td className="cust-name">{r.role}</td>
                  <td>{r.view ? <Icon name="checkSm" /> : '—'}</td>
                  <td>{r.create ? <Icon name="checkSm" /> : '—'}</td>
                  <td>{r.edit ? <Icon name="checkSm" /> : '—'}</td>
                  <td>{r.del ? <Icon name="checkSm" /> : '—'}</td>
                  <td>{r.print ? <Icon name="checkSm" /> : '—'}</td>
                  <td>{r.exp ? <Icon name="checkSm" /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 2 && (
        <div className="card card-pad">
          {featuresLoading && <div className="small-muted">Loading features…</div>}
          {!featuresLoading && features.map((f) => {
            // Which toggles actually take effect today vs. which still need an
            // external integration wired up (so the admin isn't misled).
            const LIVE = new Set(['b2c_orders', 'b2b_orders', 'qc_workflow']);
            const isLive = LIVE.has(f.key);
            return (
              <div className="toggle-row" key={f.key}>
                <div>
                  <div className="t-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.name}
                    <span className="tag" style={{ fontSize: 10, padding: '1px 7px', background: isLive ? 'var(--success-bg, #ecfdf5)' : 'var(--muted-bg, #f3f4f6)', color: isLive ? 'var(--success, #047857)' : '#6b7280' }}>
                      {isLive ? 'Live' : 'Needs setup'}
                    </span>
                  </div>
                  <div className="t-desc">{f.desc}{!isLive ? ' — requires external integration before this has any effect.' : ''}</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={f.on} onChange={() => toggleFeature(f)} />
                  <span className="slider"></span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      {tab === 3 && (
        <div className="card card-pad">
          {companyLoading && <div className="small-muted">Loading company details…</div>}
          {!companyLoading && company && (
            <>
              <div className="form-grid">
                {COMPANY_FIELD_DEFS.map((f) => (
                  <div className="form-field" key={f.key}>
                    <label>{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      value={company[f.key] ?? ''}
                      onChange={(e) => setCompany({ ...company, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="small-muted" style={{ marginTop: 12 }}>
                Bank details and the payment gateway key are encrypted at rest — only visible here to signed-in admins.
              </div>
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <button className="btn btn-primary" disabled={savingCompany} onClick={saveCompanyDetails}>{savingCompany ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 4 && (
        <div>
          <div className="small-muted" style={{ marginBottom: 12 }}>
            The <b>"Your procurement manager"</b> card shown to customers in the Garm App. Contact details here are
            company-wide and never change per order. When an order is assigned to an employee, only the <b>name</b> shown
            on that order changes to the assigned employee — phone, WhatsApp and email always stay these.
          </div>
          <div className="card card-pad">
            {!coordinator && <div className="small-muted">Loading…</div>}
            {coordinator && (
              <>
                <div className="form-grid">
                  <div className="form-field"><label>Default name (used when no employee is assigned)</label><input value={coordinator.name} onChange={(e) => setCoordinator({ ...coordinator, name: e.target.value })} /></div>
                  <div className="form-field"><label>Role line (shown under the name)</label><input value={coordinator.role} onChange={(e) => setCoordinator({ ...coordinator, role: e.target.value })} /></div>
                  <div className="form-field"><label>Phone (Call button)</label><input value={coordinator.phone} onChange={(e) => setCoordinator({ ...coordinator, phone: e.target.value })} /></div>
                  <div className="form-field"><label>WhatsApp number</label><input value={coordinator.whatsapp} onChange={(e) => setCoordinator({ ...coordinator, whatsapp: e.target.value })} /></div>
                  <div className="form-field"><label>Email (Email button)</label><input value={coordinator.email} onChange={(e) => setCoordinator({ ...coordinator, email: e.target.value })} /></div>
                </div>
                <div style={{ textAlign: 'right', marginTop: 16 }}>
                  <button className="btn btn-primary" disabled={savingCoordinator} onClick={saveCoordinator}>{savingCoordinator ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 5 && (
        <div>
          <div className="small-muted" style={{ marginBottom: 12 }}>
            Configure which sections customers see in the Garm App's <b>custom order flow</b> (garments → materials →
            sizes → references → review). Switch a section off and it disappears from the app immediately — orders
            simply skip that step. Colours, quantity and delivery are always on, since an order can't be made without them.
          </div>
          <div className="card card-pad">
            {!orderForm && <div className="small-muted">Loading…</div>}
            {orderForm && ORDER_FORM_TOGGLES.map((t) => (
              <div className="toggle-row" key={t.key}>
                <div><div className="t-name">{t.name}</div><div className="t-desc">{t.desc}</div></div>
                <label className="switch">
                  <input type="checkbox" checked={orderForm[t.key]} onChange={() => toggleOrderForm(t.key)} />
                  <span className="slider"></span>
                </label>
              </div>
            ))}
          </div>

          <div className="card card-pad" style={{ marginTop: 14 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '13.5px' }}>Service Fee</h3>
            <div className="small-muted" style={{ marginBottom: 12 }}>
              <b>This is your margin on every order</b> — added to the payable amount and shown as its own line in
              price details in the Garm App and on orders here. Defaults are set to standard profitable rates for
              made-to-order work: <b>15% + ₹49 per piece</b> for Individuals (every piece carries its own handling and
              production-setup cost, so a 3-piece order earns more than a 1-piece one), <b>8%</b> for Organisations, <b>5%</b> for bulk orders at the threshold and
              above, with a <b>₹99 minimum</b> so even a single-piece order earns a real margin. Product base prices
              in the Catalog are your other margin lever. The <b>Surplus fabric discount</b> is what customers save
              when they pick "Surplus fabric" (mill leftover stock) in the Garm App's Material step — it's shown as a
              struck-through price next to the discounted one.
            </div>
            {!serviceFee && <div className="small-muted">Loading…</div>}
            {serviceFee && (
              <>
                <div className="form-grid">
                  {SERVICE_FEE_FIELDS.map((f) => (
                    <div className="form-field" key={f.key}>
                      <label>{f.label}</label>
                      <input type="number" min={0} value={serviceFee[f.key]} onChange={(e) => setServiceFee({ ...serviceFee, [f.key]: Number(e.target.value) })} />
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right', marginTop: 14 }}>
                  <button className="btn btn-primary" disabled={savingFee} onClick={async () => {
                    setSavingFee(true);
                    try {
                      const saved = await api.updateServiceFee(serviceFee);
                      setServiceFee(saved);
                      showToast('Service fee saved — applied to new orders in the Garm App immediately.');
                    } catch (err) {
                      showToast(`Couldn't save: ${(err as Error).message}`);
                    } finally {
                      setSavingFee(false);
                    }
                  }}>{savingFee ? 'Saving…' : 'Save Service Fee'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 6 && (
        <div>
          <div className="small-muted" style={{ marginBottom: 12 }}>
            The label and description each order stage shows on the Garm App's tracking screen. The stage order and
            which order status maps to which stage is fixed (it mirrors the order workflow) — only the wording is editable.
            Stages marked <b>Organisation orders only</b> (QC, invoicing) are skipped entirely for Individuals; the
            <b> Individual orders only</b> stage (Order confirmed) is skipped for Organisations, who approve a quote instead.
          </div>
          <div className="card card-pad">
            {trackStagesLoading && <div className="small-muted">Loading stages…</div>}
            {!trackStagesLoading && trackStages.map((s, i) => (
              <div key={s.key} className="form-grid" style={{ marginBottom: i < trackStages.length - 1 ? 14 : 0, paddingBottom: i < trackStages.length - 1 ? 14 : 0, borderBottom: i < trackStages.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="form-field full" style={{ marginBottom: -6, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="tag" style={{ width: 'fit-content' }}>{s.key}</span>
                  {s.orgOnly && <span className="badge tone-info" style={{ width: 'fit-content' }}>Organisation orders only</span>}
                  {s.b2cOnly && <span className="badge tone-purple" style={{ width: 'fit-content' }}>Individual orders only</span>}
                </div>
                <div className="form-field"><label>Stage label</label><input value={s.label} onChange={(e) => updateStageField(s.key, 'label', e.target.value)} /></div>
                <div className="form-field"><label>Description</label><input value={s.sub} onChange={(e) => updateStageField(s.key, 'sub', e.target.value)} /></div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button className="btn btn-primary" disabled={savingStages} onClick={saveTrackStages}>{savingStages ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      <Modal open={addUserModal} title="Add User" confirmLabel="Add User" onClose={() => setAddUserModal(false)} onConfirm={submitAddUser}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          They'll be able to sign in immediately with this email — access is scoped to the role below.
        </div>
        <div className="form-grid">
          <div className="form-field full"><label>Full name</label><input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Jane Doe" /></div>
          <div className="form-field full"><label>Email</label><input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jane@garm.com" /></div>
          <div className="form-field full">
            <label>Role</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={!!editUser} title={`Edit Access — ${editUser?.name || ''}`} confirmLabel="Save" onClose={() => setEditUser(null)} onConfirm={submitEditUser}>
        {editUser && (
          <div className="form-grid">
            <div className="form-field full"><label>Full name</label><input value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} /></div>
            <div className="form-field full"><label>Email</label><input value={editUser.email} disabled /></div>
            <div className="form-field full">
              <label>Role</label>
              <select
                value={editUser.role}
                disabled={editUser.email === currentUser?.email}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value as ApiUser['role'] })}
              >
                {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              {editUser.email === currentUser?.email && (
                <div className="small-muted" style={{ marginTop: 4 }}>You can't change your own role.</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
