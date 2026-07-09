import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatINR, paymentsData } from '../data/mockData';

export default function Payments() {
  const showToast = useToast();
  const [recordModal, setRecordModal] = useState(false);
  const [receiptOrd, setReceiptOrd] = useState<string | null>(null);
  const receipt = paymentsData.find((p) => p.ord === receiptOrd);

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Payments</div><div className="page-desc">Track receivables and reconcile transactions.</div></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => setRecordModal(true)}><Icon name="plus" /> Record Payment</button></div>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="kpi-label">Total Collected (mo)</div><div className="kpi-value" style={{ color: 'var(--success)' }}>₹1,86,400</div></div>
        <div className="card kpi"><div className="kpi-label">Pending</div><div className="kpi-value" style={{ color: 'var(--warning)' }}>₹42,300</div></div>
        <div className="card kpi"><div className="kpi-label">Overdue</div><div className="kpi-value" style={{ color: 'var(--danger)' }}>₹11,000</div></div>
        <div className="card kpi"><div className="kpi-label">Refunded</div><div className="kpi-value" style={{ color: 'var(--muted)' }}>₹3,500</div></div>
      </div>
      <div className="filter-bar">
        <div className="search-inline"><Icon name="search" /><input placeholder="Search order #, invoice #, customer…" /></div>
        <select className="field-sm"><option>All statuses</option><option>PENDING</option><option>COMPLETED</option><option>FAILED</option><option>REFUNDED</option></select>
        <select className="field-sm"><option>All methods</option><option>Bank Transfer</option><option>Card</option><option>UPI</option><option>Cheque</option></select>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Order #</th><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th><th>Paid on</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {paymentsData.map((p) => (
              <tr key={p.ord}>
                <td className="tnum">{p.ord}</td><td>{p.inv}</td><td>{p.cust}</td><td className="tnum">{formatINR(p.amount)}</td>
                <td>{p.method.replace('_', ' ')}</td><td><Badge status={p.status} /></td><td>{p.date}</td>
                <td className="row-actions">
                  <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => setReceiptOrd(p.ord)}><Icon name="eye" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={recordModal} title="Record Payment" confirmLabel="Save Payment" onClose={() => setRecordModal(false)} onConfirm={() => showToast('Payment recorded and invoice updated')}>
        <div className="form-grid">
          <div className="form-field full"><label>Order / Invoice</label><select><option>ORD-20260701-004 / INV-20260701-004</option><option>ORD-20260622-007 / INV-20260622-007</option></select></div>
          <div className="form-field"><label>Amount (₹)</label><input type="number" placeholder="53100" /></div>
          <div className="form-field"><label>Payment method</label><select><option>Bank Transfer</option><option>Card</option><option>UPI</option><option>Cheque</option><option>Cash</option></select></div>
          <div className="form-field"><label>Payment date</label><input type="date" /></div>
          <div className="form-field"><label>Reference number</label><input placeholder="Optional" /></div>
          <div className="form-field full"><label>Notes</label><textarea className="ta" placeholder="Internal notes about this payment…"></textarea></div>
        </div>
      </Modal>

      <Modal open={!!receipt} title="Payment Receipt" confirmLabel="Print Receipt" onClose={() => setReceiptOrd(null)} onConfirm={() => window.print()}>
        {receipt && (
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            <div className="info-row"><span className="k">Order</span><span className="v">{receipt.ord}</span></div>
            <div className="info-row"><span className="k">Invoice</span><span className="v">{receipt.inv}</span></div>
            <div className="info-row"><span className="k">Customer</span><span className="v">{receipt.cust}</span></div>
            <div className="info-row"><span className="k">Amount</span><span className="v">{formatINR(receipt.amount)}</span></div>
            <div className="info-row"><span className="k">Method</span><span className="v">{receipt.method.replace('_', ' ')}</span></div>
            <div className="info-row"><span className="k">Status</span><span className="v"><Badge status={receipt.status} /></span></div>
            <div className="info-row"><span className="k">Date</span><span className="v">{receipt.date}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
