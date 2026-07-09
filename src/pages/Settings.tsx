import { useState } from 'react';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const TABS = ['Users', 'Roles & Permissions', 'Feature Toggles', 'Company Details'];

const USERS = [
  { name: 'Haneef M.', email: 'hscreators@gmail.com', role: 'Super Admin', status: 'Active', login: 'Today, 10:12 AM' },
  { name: 'Divya Raghavan', email: 'divya@garm.com', role: 'Operations Manager', status: 'Active', login: 'Yesterday, 6:40 PM' },
  { name: 'Meena Rajan', email: 'meena@garm.com', role: 'QC Supervisor', status: 'Active', login: '2 days ago' },
  { name: 'Arjun Nair', email: 'arjun@garm.com', role: 'Finance Manager', status: 'Invited', login: '—' },
];

const ROLE_PERMS = [
  { role: 'Super Admin', view: true, create: true, edit: true, del: true, print: true, exp: true },
  { role: 'Operations Manager', view: true, create: true, edit: true, del: false, print: true, exp: true },
  { role: 'QC Supervisor', view: true, create: true, edit: true, del: false, print: true, exp: false },
  { role: 'Finance Manager', view: true, create: true, edit: true, del: false, print: true, exp: true },
  { role: 'Warehouse Manager', view: true, create: false, edit: false, del: false, print: true, exp: false },
  { role: 'View-Only', view: true, create: false, edit: false, del: false, print: false, exp: false },
];

const FEATURES = [
  { name: 'B2B Orders', desc: 'Allow organizations to place bulk orders', on: true },
  { name: 'B2C Orders', desc: 'Allow individual customers to order via Garm App', on: true },
  { name: 'QC Workflow', desc: 'Require quality inspection before invoicing', on: true },
  { name: 'Payment Gateway Integration', desc: 'Enable Stripe / Razorpay online payments', on: true },
  { name: 'Email Notifications', desc: 'Send order & invoice emails automatically', on: true },
  { name: 'SMS Notifications', desc: 'Send order status updates via SMS', on: false },
  { name: 'WhatsApp Integration', desc: 'Send order updates via WhatsApp Business', on: false },
];

export default function Settings() {
  const showToast = useToast();
  const [tab, setTab] = useState(0);
  const [addUserModal, setAddUserModal] = useState(false);
  const [features, setFeatures] = useState(FEATURES);

  return (
    <div>
      <div className="page-head"><div><div className="page-title">Settings</div><div className="page-desc">Users, permissions, features and company configuration.</div></div></div>
      <div className="tabs">
        {TABS.map((t, i) => <div className={`tab ${tab === i ? 'active' : ''}`} key={t} onClick={() => setTab(i)}>{t}</div>)}
      </div>

      {tab === 0 && (
        <div>
          <div className="page-actions" style={{ justifyContent: 'flex-end', display: 'flex', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAddUserModal(true)}><Icon name="plus" /> Add User</button>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.email}>
                    <td className="cust-name">{u.name}</td><td>{u.email}</td><td><span className="tag">{u.role}</span></td>
                    <td><span className={`badge ${u.status === 'Active' ? 'tone-success' : 'tone-slate'}`}>{u.status}</span></td>
                    <td>{u.login}</td>
                    <td className="row-actions"><button className="icon-btn btn-sm" style={{ width: 30, height: 30 }}><Icon name="edit" /></button></td>
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
          {features.map((f, i) => (
            <div className="toggle-row" key={f.name}>
              <div><div className="t-name">{f.name}</div><div className="t-desc">{f.desc}</div></div>
              <label className="switch">
                <input type="checkbox" checked={f.on} onChange={() => setFeatures((fs) => fs.map((x, xi) => xi === i ? { ...x, on: !x.on } : x))} />
                <span className="slider"></span>
              </label>
            </div>
          ))}
        </div>
      )}

      {tab === 3 && (
        <div className="card card-pad">
          <div className="form-grid">
            <div className="form-field"><label>Company GST Number</label><input defaultValue="33AAAAA0000A1Z5" /></div>
            <div className="form-field"><label>Place of Supply</label><input defaultValue="Tamil Nadu" /></div>
            <div className="form-field"><label>Bank Account Holder</label><input defaultValue="Garm Manufacturing Pvt. Ltd." /></div>
            <div className="form-field"><label>Account Number</label><input defaultValue="5021 0043 8812" /></div>
            <div className="form-field"><label>IFSC Code</label><input defaultValue="HDFC0000452" /></div>
            <div className="form-field"><label>SMTP Email</label><input defaultValue="billing@garm.com" /></div>
            <div className="form-field"><label>Stripe / Razorpay API Key</label><input type="password" defaultValue="sk_live_••••••••••••" /></div>
            <div className="form-field"><label>Default Payment Terms</label><input defaultValue="Due within 30 days" /></div>
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => showToast('Company settings saved')}>Save Changes</button>
          </div>
        </div>
      )}

      <Modal open={addUserModal} title="Add User" onClose={() => setAddUserModal(false)} onConfirm={() => showToast('Add User saved')}>
        <div className="form-grid">
          <div className="form-field full"><label>Full name</label><input placeholder="Jane Doe" /></div>
          <div className="form-field full"><label>Email</label><input type="email" placeholder="jane@garm.com" /></div>
          <div className="form-field full">
            <label>Role</label>
            <select><option>Super Admin</option><option>Operations Manager</option><option>QC Supervisor</option><option>Finance Manager</option><option>Warehouse Manager</option><option>View-Only</option></select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
