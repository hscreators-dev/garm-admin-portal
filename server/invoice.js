// ─── One-click invoice PDF — dependency-free ──────────────────────────────────
// Builds a clean, single-page A4 invoice PDF from an order, with NO npm
// dependency (the admin server stays dependency-light). Returns a
// `data:application/pdf;base64,…` URL that gets stored as an order document and
// downloaded by the customer in the Garm App exactly like an uploaded file.
//
// The PDF is assembled by hand (PDF 1.4): one page, Helvetica, text + lines.
// Good enough for a professional invoice; swap for a real PDF lib later without
// touching callers — buildInvoicePdf() just needs to keep returning a data URL.

function esc(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function inr(n) {
  // "Rs." not "₹" — the base-14 PDF fonts have no rupee glyph.
  return 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

// A tiny text-layout helper that emits PDF content-stream ops.
class Page {
  constructor() { this.ops = []; }
  text(x, y, size, str, opts = {}) {
    const font = opts.bold ? '/F2' : '/F1';
    const g = opts.gray != null ? opts.gray : 0;
    this.ops.push(`${g} ${g} ${g} rg`);
    this.ops.push('BT', `${font} ${size} Tf`, `1 0 0 1 ${x} ${y} Tm`, `(${esc(str)}) Tj`, 'ET');
  }
  right(xRight, y, size, str, opts = {}) {
    // crude right-align: Helvetica avg char width ≈ 0.5 * size
    const w = str.length * size * 0.5;
    this.text(xRight - w, y, size, str, opts);
  }
  line(x1, y1, x2, y2, gray = 0.8) {
    this.ops.push(`${gray} ${gray} ${gray} RG`, '0.8 w', `${x1} ${y1} m`, `${x2} ${y2} l`, 'S');
  }
  rect(x, y, w, h, gray = 0.95) {
    this.ops.push(`${gray} ${gray} ${gray} rg`, `${x} ${y} ${w} ${h} re`, 'f');
  }
  stream() { return this.ops.join('\n'); }
}

function assemblePdf(contentStream) {
  const enc = (s) => Buffer.from(s, 'latin1');
  const objs = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>');
  objs.push(`<< /Length ${Buffer.byteLength(contentStream, 'latin1')} >>\nstream\n${contentStream}\nendstream`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return 'data:application/pdf;base64,' + enc(pdf).toString('base64');
}

/**
 * Build an invoice PDF for an order.
 * @param {object} order  admin-shaped order (see toAdminOrder): no, customer, lines, totals, dates…
 * @param {object} company  { name, addressLines[], gstin, email, phone, bankLine }
 * @returns {{ dataUrl: string, name: string, number: string }}
 */
export function buildInvoicePdf(order, company = {}) {
  const p = new Page();
  const L = 50, R = 545;              // left / right margins
  let y = 800;

  const co = {
    name: company.name || 'Garm',
    addressLines: company.addressLines || [],
    gstin: company.gstin || '',
    email: company.email || '',
    phone: company.phone || '',
    bankLine: company.bankLine || '',
  };

  // Header band
  p.rect(0, 792, 595, 50, 0.96);
  p.text(L, 812, 20, co.name, { bold: true });
  p.right(R, 818, 22, 'INVOICE', { bold: true, gray: 0.15 });

  y = 775;
  co.addressLines.forEach((ln) => { p.text(L, y, 9, ln, { gray: 0.35 }); y -= 12; });
  if (co.gstin) { p.text(L, y, 9, `GSTIN: ${co.gstin}`, { gray: 0.35 }); y -= 12; }
  const contact = [co.email, co.phone].filter(Boolean).join('  •  ');
  if (contact) { p.text(L, y, 9, contact, { gray: 0.35 }); y -= 12; }

  // Invoice meta (right side)
  const num = `INV-${(order.no || order.orderRef || '').replace(/[#]/g, '') || order.id}`;
  const dateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  let my = 775;
  p.right(R, my, 10, `Invoice #: ${num}`, { bold: true }); my -= 14;
  p.right(R, my, 9, `Date: ${dateLabel}`, { gray: 0.35 }); my -= 12;
  p.right(R, my, 9, `Order: ${order.no || order.orderRef || ''}`, { gray: 0.35 }); my -= 12;
  if (order.deliveryDate || order.etaDate) { p.right(R, my, 9, `Delivery: ${order.deliveryDate || order.etaDate}`, { gray: 0.35 }); }

  // Bill-to
  y = Math.min(y, 720);
  p.text(L, y, 9, 'BILL TO', { bold: true, gray: 0.4 }); y -= 14;
  const cust = order.customer || {};
  p.text(L, y, 12, cust.name || order.customerName || 'Customer', { bold: true }); y -= 14;
  const addr = order.delivery || {};
  [cust.phone || order.customerPhone, cust.email || order.customerEmail,
   addr.address, [addr.city, addr.pin].filter(Boolean).join(' ')]
    .filter(Boolean).forEach((ln) => { p.text(L, y, 9, ln, { gray: 0.35 }); y -= 12; });

  // Items table
  y -= 12;
  const cols = { p: L, size: 310, color: 360, qty: 420, rate: 470, total: R };
  p.rect(L, y - 4, R - L, 20, 0.94);
  p.text(cols.p + 4, y + 3, 9, 'DESCRIPTION', { bold: true, gray: 0.35 });
  p.text(cols.size, y + 3, 9, 'SIZE', { bold: true, gray: 0.35 });
  p.text(cols.color, y + 3, 9, 'COLOR', { bold: true, gray: 0.35 });
  p.right(cols.qty + 24, y + 3, 9, 'QTY', { bold: true, gray: 0.35 });
  p.right(cols.rate + 34, y + 3, 9, 'RATE', { bold: true, gray: 0.35 });
  p.right(cols.total - 4, y + 3, 9, 'AMOUNT', { bold: true, gray: 0.35 });
  y -= 24;

  const lines = (order.lines && order.lines.length ? order.lines : []);
  if (lines.length === 0) {
    p.text(cols.p + 4, y, 10, order.garmentType || order.serviceLabel || 'Custom order');
    p.right(cols.total - 4, y, 10, inr(order.total || order.quoteAmount || 0));
    y -= 18;
  } else {
    lines.forEach((ln) => {
      const desc = (ln.p || ln.name || 'Item').slice(0, 46);
      const rate = ln.unit || ln.rate || 0;
      const qty = ln.qty || 0;
      p.text(cols.p + 4, y, 10, desc);
      if (ln.size && ln.size !== '—') p.text(cols.size, y, 9, String(ln.size), { gray: 0.3 });
      if (ln.color && ln.color !== '—') p.text(cols.color, y, 9, String(ln.color), { gray: 0.3 });
      p.right(cols.qty + 24, y, 10, String(qty));
      p.right(cols.rate + 34, y, 10, inr(rate));
      p.right(cols.total - 4, y, 10, inr(rate * qty));
      y -= 18;
      if (y < 160) y = 160; // keep single-page; long orders truncate gracefully
    });
  }

  // Totals
  p.line(340, y + 6, R, y + 6);
  y -= 10;
  const subtotal = order.subtotal != null ? order.subtotal : (order.total || order.quoteAmount || 0);
  const tax = order.tax != null ? order.tax : 0;
  const serviceFee = order.serviceFee != null ? order.serviceFee : 0;
  const grand = order.total || order.quoteAmount || (subtotal + tax + serviceFee);
  const row = (label, val, bold) => {
    p.right(455, y, bold ? 11 : 10, label, { bold, gray: bold ? 0 : 0.4 });
    p.right(R - 4, y, bold ? 12 : 10, inr(val), { bold });
    y -= bold ? 20 : 16;
  };
  row('Subtotal', subtotal);
  if (tax) row('Tax (18% incl.)', tax);
  if (serviceFee) row('Service fee', serviceFee);
  p.line(360, y + 6, R, y + 6, 0.5);
  y -= 4;
  row('TOTAL', grand, true);

  // Payment status
  const paid = order.paymentStatus === 'paid' || order.pay === 'COMPLETED';
  const part = order.paymentStatus === 'partial' || order.pay === 'PARTIAL';
  const badge = paid ? 'PAID' : part ? 'ADVANCE RECEIVED' : 'PAYMENT DUE';
  p.rect(L, y - 6, 150, 22, paid ? 0.9 : 0.97);
  p.text(L + 8, y + 1, 11, badge, { bold: true, gray: paid ? 0.1 : 0.3 });

  // Footer
  if (co.bankLine) p.text(L, 110, 9, co.bankLine, { gray: 0.4 });
  p.line(L, 90, R, 90);
  p.text(L, 74, 9, 'Thank you for your business.', { gray: 0.4 });
  p.right(R, 74, 8, `Generated by ${co.name} • ${dateLabel}`, { gray: 0.55 });

  return { dataUrl: assemblePdf(p.stream()), name: `Invoice ${num}.pdf`, number: num };
}
