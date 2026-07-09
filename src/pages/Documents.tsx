import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatINR, invoicesData, type Invoice } from '../data/mockData';

const TABS = ['Invoices', 'Quotations', 'Picking Tickets', 'Packing Slips'];

export default function Documents() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  return invoice ? <InvoiceDetail invoice={invoice} onBack={() => setInvoice(null)} /> : <DocumentsList onOpenInvoice={setInvoice} />;
}

function DocumentsList({ onOpenInvoice }: { onOpenInvoice: (i: Invoice) => void }) {
  const showToast = useToast();
  const [tab, setTab] = useState(0);
  const [sendModal, setSendModal] = useState(false);

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Documents</div><div className="page-desc">Invoices, quotations, picking tickets &amp; packing slips.</div></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => showToast('New document draft created')}><Icon name="plus" /> New Document</button></div>
      </div>

      <div className="tabs">
        {TABS.map((t, i) => (
          <div className={`tab ${tab === i ? 'active' : ''}`} key={t} onClick={() => setTab(i)}>{t}</div>
        ))}
      </div>

      {tab === 0 && (
        <div>
          <div className="filter-bar">
            <div className="search-inline"><Icon name="search" /><input placeholder="Search invoice #, order #, customer…" /></div>
            <select className="field-sm"><option>All statuses</option><option>DRAFT</option><option>SENT</option><option>PARTIALLY_PAID</option><option>PAID</option><option>OVERDUE</option></select>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Invoice #</th><th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th>Sent</th><th>Due</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {invoicesData.map((inv) => (
                  <tr className="clickable" key={inv.no} onClick={() => onOpenInvoice(inv)}>
                    <td className="tnum">{inv.no}</td><td>{inv.ord}</td>
                    <td><div className="cust-name">{inv.cust}</div><div className="cust-sub">{inv.email}</div></td>
                    <td className="tnum">{formatINR(inv.total)}</td><td><Badge status={inv.status} /></td><td>{inv.sent}</td><td>{inv.due}</td>
                    <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => onOpenInvoice(inv)}><Icon name="eye" /></button>
                      <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => showToast(`Printing ${inv.no}…`)}><Icon name="printer" /></button>
                      <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => setSendModal(true)}><Icon name="mail" /></button>
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
            <thead><tr><th>Quotation #</th><th>Customer</th><th>Total</th><th>Valid Till</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              <tr><td className="tnum">QTN-0421</td><td>Acme Corp</td><td>₹31,200</td><td>28 Jul 2026</td><td><span className="badge tone-info">SENT</span></td><td className="row-actions"><button className="icon-btn btn-sm" style={{ width: 30, height: 30 }}><Icon name="eye" /></button></td></tr>
              <tr><td className="tnum">QTN-0418</td><td>Priya Sharma</td><td>₹8,400</td><td>20 Jul 2026</td><td><span className="badge tone-success">ACCEPTED</span></td><td className="row-actions"><button className="icon-btn btn-sm" style={{ width: 30, height: 30 }}><Icon name="eye" /></button></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 2 && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Ticket #</th><th>Order #</th><th>Items</th><th>Picked</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              <tr><td className="tnum">PT-0421</td><td>ORD-20260701-004</td><td>3 lines</td><td><span className="badge tone-warning">In progress</span></td><td className="row-actions"><button className="icon-btn btn-sm" style={{ width: 30, height: 30 }}><Icon name="printer" /></button></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 3 && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Slip #</th><th>Order #</th><th>Customer</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              <tr><td className="tnum">PS-0421</td><td>ORD-20260701-004</td><td>Acme Corp</td><td className="row-actions"><button className="icon-btn btn-sm" style={{ width: 30, height: 30 }}><Icon name="printer" /></button></td></tr>
            </tbody>
          </table>
        </div>
      )}

      <Modal open={sendModal} title="Send Invoice" confirmLabel="Send" onClose={() => setSendModal(false)} onConfirm={() => showToast('Invoice emailed to customer')}>
        <div className="form-grid">
          <div className="form-field full"><label>Recipient email</label><input type="email" defaultValue="hr@acmecorp.com" /></div>
          <div className="form-field full"><label>Message</label><textarea className="ta" defaultValue="Please find attached your invoice. Payment is due within 30 days."></textarea></div>
        </div>
      </Modal>
    </div>
  );
}

function InvoiceDetail({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const showToast = useToast();
  const [sendModal, setSendModal] = useState(false);

  return (
    <div>
      <div className="back-btn" onClick={onBack}><Icon name="arrowLeft" /> Back to Documents</div>
      <div className="page-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Icon name="printer" /> Print</button>
        <button className="btn btn-outline btn-sm" onClick={() => showToast('Invoice downloaded as PDF')}><Icon name="download" /> Download PDF</button>
        <button className="btn btn-outline btn-sm" onClick={() => setSendModal(true)}><Icon name="mail" /> Send</button>
        <button className="btn btn-primary btn-sm" onClick={() => showToast('Invoice marked as PAID')}><Icon name="check" /> Mark as Paid</button>
      </div>

      <div className="doc-preview">
        <div className="dp-head">
          <div>
            <h2>INVOICE</h2>
            <div className="small-muted">Garm Manufacturing Pvt. Ltd.<br />4th Floor, Textile Hub, Chennai, TN 600001<br />GSTIN: 33AAAAA0000A1Z5</div>
          </div>
          <div className="dp-meta">
            <div><b>Invoice #</b> {invoice.no}</div>
            <div><b>Order #</b> {invoice.ord}</div>
            <div><b>Issue date</b> {invoice.sent}</div>
            <div><b>Due date</b> {invoice.due}</div>
          </div>
        </div>
        <div className="dp-parties">
          <div className="blk"><div className="lbl">Billed To</div>{invoice.cust}<br />GSTIN: 29BBBBB1111B2Z6<br />{invoice.email}</div>
          <div className="blk"><div className="lbl">Ship To</div>{invoice.cust}<br />Plot 12, Industrial Area<br />Bengaluru, KA 560068</div>
        </div>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            <tr><td>Garm Shirt — Black, L (Custom embroidery)</td><td>100</td><td>₹250</td><td>18%</td><td style={{ textAlign: 'right' }}>₹29,500</td></tr>
            <tr><td>Garm Shirt — White, M</td><td>80</td><td>₹250</td><td>18%</td><td style={{ textAlign: 'right' }}>₹23,600</td></tr>
          </tbody>
        </table>
        <div className="dp-totals">
          <div className="r"><span>Subtotal</span><span>{formatINR(Math.round(invoice.total / 1.18))}</span></div>
          <div className="r"><span>Tax (18%)</span><span>{formatINR(invoice.total - Math.round(invoice.total / 1.18))}</span></div>
          <div className="r"><span>Discount</span><span>−₹0</span></div>
          <div className="r total"><span>Total Due</span><span>{formatINR(invoice.total)}</span></div>
        </div>
        <div className="dp-footer">
          <div>Bank: HDFC Bank · A/C 5021 0043 8812 · IFSC HDFC0000452</div>
          <div>Payment terms: Due within 30 days</div>
        </div>
      </div>

      <Modal open={sendModal} title="Send Invoice" confirmLabel="Send" onClose={() => setSendModal(false)} onConfirm={() => showToast('Invoice emailed to customer')}>
        <div className="form-grid">
          <div className="form-field full"><label>Recipient email</label><input type="email" defaultValue={invoice.email} /></div>
          <div className="form-field full"><label>Message</label><textarea className="ta" defaultValue="Please find attached your invoice. Payment is due within 30 days."></textarea></div>
        </div>
      </Modal>
    </div>
  );
}
