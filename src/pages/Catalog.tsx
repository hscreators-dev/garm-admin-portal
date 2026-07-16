import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { api, type Audience, type Category, type Product, type ProductType, type ProductColor, type ProductSpecField } from '../api/client';
import { onLiveEvent } from '../api/liveBus';

// ─── Catalog — restored and rebuilt around what actually syncs to the Garm App:
// availability (active/inactive), stock, price, colours, and — new — the SPEC
// FIELDS customers fill per accessory (Material, Finish, Print method…).
// Accessory products come pre-filled with the app's built-in lists, so this
// page always shows the same options customers see, ready to edit.

function typeLabel(t: Audience) { return t === 'B2C' ? 'Individuals' : 'Organizations'; }

const PRODUCT_TYPES: { value: ProductType; label: string; hint: string }[] = [
  { value: 'GARMENT', label: 'Garment', hint: 'Fabric, GSM, sizes, stitching & packaging apply' },
  { value: 'ACCESSORY', label: 'Accessory / Promo item', hint: 'Mugs, pens, banners, ID cards… spec fields apply' },
  { value: 'OTHER', label: 'Other', hint: 'Anything else — pick which fields apply' },
];

// Spec-field rows keep the raw comma text alongside parsed options so typing
// commas feels natural in the editor.
type SpecFieldDraft = ProductSpecField;

function Thumb({ image, fallback }: { image: string | null; fallback: string }) {
  if (image) return <img src={image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return <div className="ph-thumb">{fallback.charAt(0).toUpperCase()}</div>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Per-option price adjustments (₹ added to / subtracted from the base price when
// the customer picks that fabric / GSM / weave / style in the Garm App). Keyed
// by the exact option label. Missing/0 = no change. This is what lets the admin
// price each fabric, GSM, weave and style individually.
export interface OptionPrices {
  style: Record<string, number>;
  fabric: Record<string, number>;
  gsm: Record<string, number>;
  weave: Record<string, number>;
}
const emptyOptionPrices = (): OptionPrices => ({ style: {}, fabric: {}, gsm: {}, weave: {} });
// Keep only the price deltas for options that still exist (and are non-zero),
// so removed options don't leave orphan prices behind.
function pickDeltas(deltas: Record<string, number>, options: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const opt of options) { const d = deltas[opt]; if (d) out[opt] = Math.round(d); }
  return out;
}

interface ProdForm {
  name: string; categoryId: number; productType: ProductType; inStock: boolean; price: number;
  sizes: string; colors: ProductColor[]; specFields: SpecFieldDraft[]; moq: number;
  status: 'ACTIVE' | 'INACTIVE'; image: string | null; description: string;
  // Garment configurator lists — the SAME lists the Garm App shows in its
  // Style and Material steps. Edited as chips (add/remove), not typed text.
  styles: string[]; fabricOptions: string[]; gsmOptions: string[]; weaveOptions: string[];
  // Per-option ₹ price adjustments (see OptionPrices).
  optionPrices: OptionPrices;
}

// Chip-style list editor: existing options as removable chips + an input to
// add one at a time. Replaces the error-prone comma-separated text fields.
function ListEditor({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...value, v]);
    setDraft('');
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((v, i) => (
            <span key={`${v}-${i}`} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
              {v}
              <button type="button" title={`Remove ${v}`} onClick={() => onChange(value.filter((_, x) => x !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13, color: '#6b7280' }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={draft} placeholder={placeholder} style={{ flex: 1 }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={add} disabled={!draft.trim()}>+ Add</button>
      </div>
    </div>
  );
}

// Like ListEditor, but each option also carries a ₹ price adjustment (delta
// from the product's base price). Used for fabrics / GSM / weaves / styles so
// the admin can price each option. `prices` maps option label → ₹ delta.
function PricedListEditor({ value, prices, onChange, onPrices, placeholder, base }:
  { value: string[]; prices: Record<string, number>; onChange: (v: string[]) => void;
    onPrices: (p: Record<string, number>) => void; placeholder: string; base: number }) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...value, v]);
    setDraft('');
  }
  function remove(i: number) {
    const label = value[i];
    onChange(value.filter((_, x) => x !== i));
    if (label in prices) { const next = { ...prices }; delete next[label]; onPrices(next); }
  }
  function setDelta(label: string, delta: number) {
    onPrices({ ...prices, [label]: delta });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {value.map((v, i) => {
        const delta = prices[v] ?? 0;
        const finalPrice = Math.max(0, base + delta);
        return (
          <div key={`${v}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', minWidth: 120 }}>
              {v}
              <button type="button" title={`Remove ${v}`} onClick={() => remove(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13, color: '#6b7280' }}>×</button>
            </span>
            <span className="small-muted" style={{ fontSize: 12 }}>base ₹{base}</span>
            <span className="small-muted" style={{ fontSize: 12 }}>+/− ₹</span>
            <input type="number" value={delta} onChange={(e) => setDelta(v, Math.round(Number(e.target.value) || 0))}
              style={{ width: 74 }} title="₹ added to (or subtracted from) the base price for this option" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>= ₹{finalPrice}/pc</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={draft} placeholder={placeholder} style={{ flex: 1 }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={add} disabled={!draft.trim()}>+ Add</button>
      </div>
    </div>
  );
}

// New-garment starting points — the Garm App's own defaults (its t-shirt
// fabric list, its weave list, its 8-colour palette). All editable per product.
const GARMENT_DEFAULT_FABRICS = ['Soft 100% Cotton', 'Cotton-Poly Blend', 'Dri-fit Polyester', 'Slub Cotton', 'Bamboo Blend'];
const GARMENT_DEFAULT_GSM = ['140\u2013160 GSM (lightweight)', '180\u2013200 GSM (standard)', '220\u2013240 GSM (premium)'];
const GARMENT_DEFAULT_WEAVES = ['Plain', 'Twill', 'Jersey knit', 'Pique', 'Custom'];
const GARMENT_DEFAULT_COLORS: ProductColor[] = [
  { label: 'Black', hex: '#111111' }, { label: 'White', hex: '#ffffff' },
  { label: 'Light Grey', hex: '#e5e5e5' }, { label: 'Navy Blue', hex: '#1a2540' },
  { label: 'Red', hex: '#d4394a' }, { label: 'Forest Green', hex: '#2d5a3d' },
  { label: 'Golden', hex: '#c8a84b' }, { label: 'Burgundy', hex: '#8b3a3a' },
];

function emptyProdForm(categoryId: number): ProdForm {
  return {
    name: '', categoryId, productType: 'GARMENT', inStock: true, price: 250,
    sizes: 'S, M, L, XL', colors: [...GARMENT_DEFAULT_COLORS], specFields: [], moq: 50,
    status: 'ACTIVE', image: null, description: '',
    styles: [], fabricOptions: [...GARMENT_DEFAULT_FABRICS],
    gsmOptions: [...GARMENT_DEFAULT_GSM], weaveOptions: [...GARMENT_DEFAULT_WEAVES],
    optionPrices: emptyOptionPrices(),
  };
}

export default function Catalog() {
  const showToast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogType, setCatalogType] = useState<Audience>('B2C');
  const [subTab, setSubTab] = useState<'categories' | 'products'>('categories');
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatus, setProdStatus] = useState('');
  const [prodType, setProdType] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const PROD_PAGE_SIZE = 12;

  const [catModal, setCatModal] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [catForm, setCatForm] = useState<{ name: string; image: string | null; description: string }>({ name: '', image: null, description: '' });

  const [prodModal, setProdModal] = useState<{ open: boolean; editing: Product | null }>({ open: false, editing: null });
  const [prodForm, setProdForm] = useState<ProdForm>(emptyProdForm(0));
  // Surplus-fabric discount (Settings → Order Form) — shown next to Base price
  // so New vs Surplus pricing is visible while editing a garment.
  const [surplusPct, setSurplusPct] = useState(15);
  // Spec-field starter templates (Material/Finish/Print/Device spec…) keyed by
  // category name — lets new accessory products start from a ready-made set.
  const [specTemplates, setSpecTemplates] = useState<Record<string, ProductSpecField[]>>({});
  useEffect(() => {
    api.getSettings().then((st) => {
      const v = st.serviceFee?.surplusDiscountPercent;
      if (typeof v === 'number' && v >= 0 && v <= 90) setSurplusPct(v);
    }).catch(() => {});
    api.getSpecTemplates().then((d) => setSpecTemplates(d.templates || {})).catch(() => {});
  }, []);
  // Deep-clone a template's fields so edits don't mutate the shared reference.
  function applySpecTemplate(name: string) {
    const tpl = specTemplates[name];
    if (!tpl) return;
    setProdForm((f) => ({ ...f, specFields: tpl.map((sf) => ({ label: sf.label, options: [...sf.options], ...(sf.hint ? { hint: sf.hint } : {}) })) }));
  }

  function refresh(audience: Audience) {
    setLoading(true);
    Promise.all([api.getCategories(audience), api.getProducts(audience)])
      .then(([cats, prods]) => { setCategories(cats); setProducts(prods); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(catalogType); }, [catalogType]);

  useEffect(() => {
    const offs = [
      onLiveEvent<Category>('category:created', (c) => { if (c.audience === catalogType) setCategories((prev) => [...prev, c]); }),
      onLiveEvent<Category>('category:updated', (c) => { if (c.audience === catalogType) setCategories((prev) => prev.map((x) => (x.id === c.id ? c : x))); }),
      onLiveEvent<{ id: number; audience: Audience }>('category:deleted', ({ id, audience }) => { if (audience === catalogType) setCategories((prev) => prev.filter((x) => x.id !== id)); }),
      onLiveEvent<Product>('product:created', (p) => { if (p.audience === catalogType) setProducts((prev) => [...prev, p]); }),
      onLiveEvent<Product>('product:updated', (p) => { if (p.audience === catalogType) setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x))); }),
      onLiveEvent<Product>('product:deactivated', (p) => { if (p.audience === catalogType) setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x))); }),
      onLiveEvent<{ id: number; audience: Audience }>('product:deleted', ({ id, audience }) => { if (audience === catalogType) setProducts((prev) => prev.filter((x) => x.id !== id)); }),
    ];
    return () => offs.forEach((off) => off());
  }, [catalogType]);

  // Reset to page 1 whenever the result set changes shape.
  useEffect(() => { setProdPage(1); }, [catalogType, prodSearch, prodStatus, prodType]);

  const visibleProducts = useMemo(() => products.filter((p) => {
    if (prodSearch && !p.name.toLowerCase().includes(prodSearch.toLowerCase())) return false;
    if (prodStatus === 'OUT_OF_STOCK') { if (p.inStock !== false) return false; }
    else if (prodStatus && p.status !== prodStatus) return false;
    if (prodType && (p.productType || 'GARMENT') !== prodType) return false;
    return true;
  }), [products, prodSearch, prodStatus, prodType]);

  // ── Category modal ─────────────────────────────────────────────────────────
  function openAddCategory() {
    setCatForm({ name: '', image: null, description: '' });
    setCatModal({ open: true, editing: null });
  }
  function openEditCategory(c: Category) {
    setCatForm({ name: c.name, image: c.image, description: c.description || '' });
    setCatModal({ open: true, editing: c });
  }
  async function saveCategoryModal(): Promise<boolean | void> {
    const name = catForm.name.trim();
    if (!name) { showToast('Give the category a name first'); return false; }
    const dup = categories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase() && c.id !== catModal.editing?.id);
    if (dup) { showToast(`A category called "${name}" already exists in the ${typeLabel(catalogType)} catalog`); return false; }
    const payload = { name, image: catForm.image, description: catForm.description };
    try {
      if (catModal.editing) {
        await api.updateCategory(catalogType, catModal.editing.id, payload);
        showToast(`${payload.name} saved — pushed live to the Garm App`);
      } else {
        const created = await api.createCategory(catalogType, payload);
        showToast(`${payload.name} created — now add its first product`);
        // A category is useless without products — flow straight into Add
        // Product with the new category pre-selected.
        setSubTab('products');
        setProdForm(emptyProdForm(created.id));
        setTimeout(() => setProdModal({ open: true, editing: null }), 250);
      }
    } catch (err) {
      showToast(`Could not save category: ${(err as Error).message}`);
      return false; // keep the modal open — nothing was saved
    }
  }
  async function removeCategory(c: Category) {
    if (products.some((p) => p.categoryId === c.id)) { showToast('Move or remove products in this category first'); return; }
    const ok = await confirm({
      title: 'Delete category?',
      message: `"${c.name}" will be removed permanently and disappears from the Garm App immediately.`,
      confirmLabel: 'Delete category', tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteCategory(catalogType, c.id);
      showToast(`${c.name} removed — Garm App updated`);
    } catch (err) {
      showToast(`Could not remove category: ${(err as Error).message}`);
    }
  }

  // ── Product modal ──────────────────────────────────────────────────────────
  function openAddProduct(categoryId?: number) {
    if (categories.length === 0) { showToast('Create a category first — every product needs one'); setSubTab('categories'); return; }
    const cid = categoryId ?? categories[0]?.id ?? 0;
    const form = emptyProdForm(cid);
    // If this category matches a known accessory template (e.g. "Mobile & Tech",
    // "Bottles & Mugs"), start an ACCESSORY product pre-filled with its spec
    // fields — the same lists the app's built-in products carry.
    const cat = categories.find((c) => c.id === cid);
    const tpl = cat && specTemplates[cat.name];
    if (tpl) {
      form.productType = 'ACCESSORY';
      form.specFields = tpl.map((sf) => ({ label: sf.label, options: [...sf.options], ...(sf.hint ? { hint: sf.hint } : {}) }));
    }
    setProdForm(form);
    setProdModal({ open: true, editing: null });
  }
  function openEditProduct(p: Product) {
    setProdForm({
      name: p.name, categoryId: p.categoryId, productType: p.productType || 'GARMENT', inStock: p.inStock !== false,
      price: p.price, sizes: p.sizes.join(', '), colors: p.colors || [], specFields: (p.specFields || []) as SpecFieldDraft[],
      moq: p.moq, status: p.status, image: p.image, description: p.description || '',
      styles: [...(p.styles || [])],
      fabricOptions: [...(p.fabricOptions || [])],
      gsmOptions: [...(p.gsmOptions || [])],
      weaveOptions: [...(p.weaveOptions || [])],
      optionPrices: {
        style:  { ...(p.optionPrices?.style  || {}) },
        fabric: { ...(p.optionPrices?.fabric || {}) },
        gsm:    { ...(p.optionPrices?.gsm    || {}) },
        weave:  { ...(p.optionPrices?.weave  || {}) },
      },
    });
    setProdModal({ open: true, editing: p });
  }
  async function saveProductModal(): Promise<boolean | void> {
    const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const isGarment = prodForm.productType === 'GARMENT';
    const name = prodForm.name.trim();
    if (!name) { showToast('Give the product a name first'); return false; }
    // Names must be unique per catalog — the Garm App matches products BY NAME
    // for stock, colours and spec fields, so a duplicate would be ambiguous.
    const dup = products.some((pr) => pr.name.trim().toLowerCase() === name.toLowerCase() && pr.id !== prodModal.editing?.id);
    if (dup) { showToast(`"${name}" already exists in the ${typeLabel(catalogType)} catalog — use a distinct name`); return false; }
    if (!prodForm.categoryId) { showToast('Pick a category for this product'); return false; }
    const payload = {
      name,
      categoryId: prodForm.categoryId,
      productType: prodForm.productType,
      inStock: prodForm.inStock,
      price: prodForm.price,
      sizes: isGarment || prodForm.productType === 'OTHER' ? splitList(prodForm.sizes) : [],
      colors: prodForm.colors.filter((c) => c.label.trim()),
      specFields: prodForm.specFields
        .map(({ label, options, hint }) => ({ label: label.trim(), options, hint }))
        .filter((sf) => sf.label && sf.options.length > 0),
      moq: prodForm.moq,
      status: prodForm.status,
      image: prodForm.image,
      description: prodForm.description,
      // Garment configurator lists — only meaningful for garments.
      styles: isGarment ? prodForm.styles : [],
      fabricOptions: isGarment ? prodForm.fabricOptions : [],
      gsmOptions: isGarment ? prodForm.gsmOptions : [],
      weaveOptions: isGarment ? prodForm.weaveOptions : [],
      // Per-option ₹ price adjustments — only kept for options that still exist.
      optionPrices: isGarment ? {
        style:  pickDeltas(prodForm.optionPrices.style,  prodForm.styles),
        fabric: pickDeltas(prodForm.optionPrices.fabric, prodForm.fabricOptions),
        gsm:    pickDeltas(prodForm.optionPrices.gsm,    prodForm.gsmOptions),
        weave:  pickDeltas(prodForm.optionPrices.weave,  prodForm.weaveOptions),
      } : emptyOptionPrices(),
    };
    try {
      if (prodModal.editing) {
        await api.updateProduct(catalogType, prodModal.editing.id, payload);
      } else {
        await api.createProduct(catalogType, payload);
      }
      showToast(`${payload.name} saved — pushed live to the Garm App`);
    } catch (err) {
      showToast(`Could not save product: ${(err as Error).message}`);
      return false; // keep the modal open — nothing was saved
    }
  }

  // ── Row toggles ────────────────────────────────────────────────────────────
  async function toggleStatus(p: Product) {
    const next = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.setProductStatus(catalogType, p.id, next);
      showToast(`${p.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'} — synced to Garm App`);
    } catch (err) {
      showToast(`Could not update product: ${(err as Error).message}`);
    }
  }
  async function removeProduct(p: Product) {
    const ok = await confirm({
      title: 'Delete product?',
      message: `"${p.name}" will be removed permanently and disappears from the Garm App immediately. Tip: use Deactivate or Out of stock to hide it temporarily instead.`,
      confirmLabel: 'Delete product', tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteProduct(catalogType, p.id);
      showToast(`${p.name} deleted — Garm App updated`);
    } catch (err) {
      showToast(`Could not delete: ${(err as Error).message}`);
    }
  }

  async function toggleStock(p: Product) {
    const next = !(p.inStock !== false);
    try {
      await api.setProductStock(catalogType, p.id, next);
      showToast(next ? `${p.name} back in stock — orderable in the Garm App again` : `${p.name} marked out of stock — shown greyed out in the Garm App`);
    } catch (err) {
      showToast(`Could not update stock: ${(err as Error).message}`);
    }
  }

  // ── Colour + spec-field editors ────────────────────────────────────────────
  function updateColor(i: number, patch: Partial<ProductColor>) {
    setProdForm((f) => ({ ...f, colors: f.colors.map((c, x) => (x === i ? { ...c, ...patch } : c)) }));
  }
  function updateSpecField(i: number, patch: Partial<{ label: string }>) {
    setProdForm((f) => ({
      ...f,
      specFields: f.specFields.map((sf, x) => x !== i ? sf : ({ ...sf, label: patch.label !== undefined ? patch.label : sf.label })),
    }));
  }
  // Options are edited as chips now (ListEditor) — no more comma-separated text.
  function updateSpecFieldOptions(i: number, options: string[]) {
    setProdForm((f) => ({
      ...f,
      specFields: f.specFields.map((sf, x) => (x === i ? { ...sf, options } : sf)),
    }));
  }

  if (loading) return <div className="small-muted" style={{ padding: 24 }}>Loading catalog from the backend…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Catalog</div>
          <div className="page-desc">Availability, stock, price, colours and the spec options customers pick — changes publish live to the Garm App.</div>
        </div>
        <div className="page-actions"><span className="sync-badge"><span className="sync-dot"></span>Live sync connected</span></div>
      </div>

      <div className="seg-tabs">
        <button className={`seg-tab ${catalogType === 'B2C' ? 'active' : ''}`} onClick={() => setCatalogType('B2C')}>
          <Icon name="user" /> Individuals
        </button>
        <button className={`seg-tab ${catalogType === 'B2B' ? 'active' : ''}`} onClick={() => setCatalogType('B2B')}>
          <Icon name="factory" /> Organizations
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <div className={`tab ${subTab === 'categories' ? 'active' : ''}`} onClick={() => setSubTab('categories')}>Categories</div>
        <div className={`tab ${subTab === 'products' ? 'active' : ''}`} onClick={() => setSubTab('products')}>Products</div>
      </div>

      {subTab === 'categories' && (
        <div>
          <div className="page-actions" style={{ justifyContent: 'flex-end', display: 'flex', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={openAddCategory}><Icon name="plus" /> Add Category</button>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Image</th><th>Category</th><th>Products</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {categories.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>No categories yet — add your first one.</td></tr>
                )}
                {categories.map((c) => {
                  const count = products.filter((p) => p.categoryId === c.id).length;
                  return (
                    <tr key={c.id}>
                      <td><div className="thumb-38"><Thumb image={c.image} fallback={c.name} /></div></td>
                      <td className="cust-name">{c.name}</td>
                      <td>{count} product{count === 1 ? '' : 's'}</td>
                      <td className="row-actions">
                        <button className="btn btn-outline btn-sm" title="Add a product to this category" onClick={() => { setSubTab('products'); openAddProduct(c.id); }}><Icon name="plus" /> Product</button>
                        <button className="icon-btn btn-sm" title="Edit category" style={{ width: 36, height: 36 }} onClick={() => openEditCategory(c)}><Icon name="edit" /></button>
                        <button className="icon-btn btn-sm" title="Delete category" style={{ width: 36, height: 36 }} onClick={() => removeCategory(c)}><Icon name="x" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'products' && (
        <div>
          <div className="filter-bar">
            <div className="search-inline"><Icon name="search" /><input placeholder="Search products…" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} /></div>
            <select className="field-sm" value={prodType} onChange={(e) => setProdType(e.target.value)}>
              <option value="">All types</option><option value="GARMENT">Garments</option><option value="ACCESSORY">Accessories</option><option value="OTHER">Other</option>
            </select>
            <select className="field-sm" value={prodStatus} onChange={(e) => setProdStatus(e.target.value)}>
              <option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option><option value="OUT_OF_STOCK">Out of stock</option>
            </select>
            <div style={{ flex: 1 }}></div>
            <button className="btn btn-primary btn-sm" onClick={() => openAddProduct()}><Icon name="plus" /> Add Product</button>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Image</th><th>Product</th><th>Type</th><th>Category</th><th>Spec options</th><th>Price</th><th>Stock</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {visibleProducts.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>No products match these filters.</td></tr>
                )}
                {visibleProducts.slice((Math.min(prodPage, Math.ceil(visibleProducts.length / PROD_PAGE_SIZE) || 1) - 1) * PROD_PAGE_SIZE, Math.min(prodPage, Math.ceil(visibleProducts.length / PROD_PAGE_SIZE) || 1) * PROD_PAGE_SIZE).map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const inStock = p.inStock !== false;
                  const specCount = p.specFields?.length ?? 0;
                  return (
                    <tr key={p.id}>
                      <td><div className="thumb-38"><Thumb image={p.image} fallback={p.name.replace('Garm ', '')} /></div></td>
                      <td className="cust-name">
                        {p.name}
                        {p.sizes.length > 0 && <div className="cust-sub">{p.sizes.join(', ')}</div>}
                        {(p.colors?.length ?? 0) > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            {p.colors.slice(0, 6).map((c, i) => (
                              <span key={i} title={`${c.label} (${c.hex})`} style={{ width: 12, height: 12, borderRadius: '50%', background: c.hex, border: '1px solid rgba(0,0,0,0.18)', display: 'inline-block' }} />
                            ))}
                            {p.colors.length > 6 && <span className="cust-sub">+{p.colors.length - 6}</span>}
                          </div>
                        )}
                      </td>
                      <td><span className="tag">{p.productType === 'ACCESSORY' ? 'Accessory' : p.productType === 'OTHER' ? 'Other' : 'Garment'}</span></td>
                      <td>{cat ? cat.name : '—'}</td>
                      <td>
                        {specCount > 0
                          ? <><div>{specCount} field{specCount === 1 ? '' : 's'}</div><div className="cust-sub">{(p.specFields || []).map((sf) => sf.label).slice(0, 3).join(', ')}</div></>
                          : <span className="small-muted">—</span>}
                      </td>
                      <td className="tnum">₹{p.price.toLocaleString('en-IN')}</td>
                      <td>
                        <label className="stock-toggle" title="Availability shown live in the Garm App">
                          <input type="checkbox" checked={inStock} onChange={() => toggleStock(p)} />
                          <span style={{ fontSize: 12, color: inStock ? 'var(--success, #059669)' : 'var(--danger, #dc2626)', fontWeight: 600 }}>
                            {inStock ? 'In stock' : 'Out of stock'}
                          </span>
                        </label>
                      </td>
                      <td><Badge status={p.status} /></td>
                      <td className="row-actions">
                        <button className="icon-btn btn-sm" title="Edit product & spec options" style={{ width: 36, height: 36 }} onClick={() => openEditProduct(p)}><Icon name="edit" /></button>
                        <button className="icon-btn btn-sm" title={p.status === 'ACTIVE' ? 'Deactivate (hide from Garm App)' : 'Activate'} style={{ width: 36, height: 36 }} onClick={() => toggleStatus(p)}><Icon name={p.status === 'ACTIVE' ? 'xCircle' : 'checkCircle'} /></button>
                        <button className="icon-btn btn-sm" title="Delete permanently" style={{ width: 36, height: 36 }} onClick={() => removeProduct(p)}><Icon name="x" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pager">
              <span>Showing <b>{Math.min(PROD_PAGE_SIZE, Math.max(0, visibleProducts.length - (prodPage - 1) * PROD_PAGE_SIZE))}</b> of <b>{visibleProducts.length}</b> products</span>
              <div className="pager-btns">
                <button disabled={prodPage <= 1} onClick={() => setProdPage(prodPage - 1)}><Icon name="chevLeft" /></button>
                {Array.from({ length: Math.max(1, Math.ceil(visibleProducts.length / PROD_PAGE_SIZE)) }, (_, i) => i + 1).slice(0, 8).map((n) => (
                  <button key={n} className={n === prodPage ? 'active' : ''} onClick={() => setProdPage(n)}>{n}</button>
                ))}
                <button disabled={prodPage >= Math.ceil(visibleProducts.length / PROD_PAGE_SIZE)} onClick={() => setProdPage(prodPage + 1)}><Icon name="chevRight" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category modal ── */}
      <Modal
        open={catModal.open}
        title={catModal.editing ? 'Edit Category' : 'Add Category'}
        confirmLabel={catModal.editing ? 'Save Changes' : 'Add Category'}
        onClose={() => setCatModal({ open: false, editing: null })}
        onConfirm={saveCategoryModal}
      >
        <div className="form-grid">
          <div className="form-field full"><label>Category name</label><input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Accessories" /></div>
          <div className="form-field full">
            <label>Description (shown as a subtitle under the category in the Garm App)</label>
            <textarea rows={2} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} placeholder="e.g. Banners, standees, stickers, keychains, whistles" />
          </div>
          <div className="small-muted" style={{ margin: '-4px 0 2px' }}>Adding to the <b>{typeLabel(catalogType)}</b> catalog — switch tabs to add it to {typeLabel(catalogType === 'B2C' ? 'B2B' : 'B2C')} instead.</div>
          <div className="form-field full">
            <label>Category image</label>
            <div className="upload-row">
              <div className="upload-preview">
                {catForm.image ? <img src={catForm.image} /> : <div className="upload-placeholder"><Icon name="upload" /></div>}
              </div>
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setCatForm({ ...catForm, image: await readFileAsDataUrl(file) });
              }} />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Product modal ── */}
      <Modal
        open={prodModal.open}
        title={prodModal.editing ? `Edit ${prodModal.editing.name}` : 'Add Product'}
        confirmLabel={prodModal.editing ? 'Save Changes' : 'Add Product & Publish'}
        onClose={() => setProdModal({ open: false, editing: null })}
        onConfirm={saveProductModal}
      >
        <div className="form-grid">
          <div className="form-field full">
            <label>Product type</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRODUCT_TYPES.map((t) => (
                <label key={t.value} className="tag" style={{ cursor: 'pointer', padding: '8px 12px', border: prodForm.productType === t.value ? '1.5px solid var(--ink, #111)' : '1px solid var(--border)', borderRadius: 10, flex: '1 1 150px' }}>
                  <input type="radio" name="productType" checked={prodForm.productType === t.value} onChange={() => setProdForm({ ...prodForm, productType: t.value })} style={{ marginRight: 6 }} />
                  <b>{t.label}</b>
                  <div className="small-muted" style={{ fontSize: 11, marginTop: 2 }}>{t.hint}</div>
                </label>
              ))}
            </div>
          </div>
          <div className="form-field full"><label>Product name</label><input value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} placeholder={prodForm.productType === 'ACCESSORY' ? 'e.g. Coffee Mugs' : 'e.g. Hoodies'} /></div>
          <div className="form-field">
            <label>Category</label>
            <select value={prodForm.categoryId} onChange={(e) => setProdForm({ ...prodForm, categoryId: Number(e.target.value) })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Base price (₹/pc · New fabric)</label>
            <input type="number" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: Number(e.target.value) })} />
            {prodForm.productType === 'GARMENT' && prodForm.price > 0 && (
              <div className="small-muted" style={{ marginTop: 4 }}>
                New fabric: <b>₹{Math.round(prodForm.price).toLocaleString('en-IN')}/pc</b> · Surplus fabric:{' '}
                <b>₹{Math.max(1, Math.round(prodForm.price * (1 - surplusPct / 100))).toLocaleString('en-IN')}/pc</b>{' '}
                ({surplusPct}% off — change in <b>Settings → Order Form</b>). The Garm App shows both prices to the customer.
              </div>
            )}
          </div>
          <div className="small-muted" style={{ margin: '-4px 0 2px' }}>Adding to the <b>{typeLabel(catalogType)}</b> catalog — switch tabs to add it to {typeLabel(catalogType === 'B2C' ? 'B2B' : 'B2C')} instead.</div>
          {prodForm.productType !== 'ACCESSORY' && (
            <div className="form-field"><label>Sizes (comma separated)</label><input value={prodForm.sizes} onChange={(e) => setProdForm({ ...prodForm, sizes: e.target.value })} placeholder="e.g. S, M, L, XL" /></div>
          )}
          <div className="form-field"><label>Min. order qty (Organizations)</label><input type="number" value={prodForm.moq} onChange={(e) => setProdForm({ ...prodForm, moq: Number(e.target.value) })} /></div>
          <div className="form-field">
            <label>Status</label>
            <select value={prodForm.status} onChange={(e) => setProdForm({ ...prodForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}>
              <option>ACTIVE</option><option>INACTIVE</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="tag" style={{ width: 'fit-content' }}>
              <input type="checkbox" checked={prodForm.inStock} onChange={(e) => setProdForm({ ...prodForm, inStock: e.target.checked })} /> In stock — customers can order this right now (unticked = shown greyed out as "Out of stock" in the Garm App)
            </label>
          </div>

          {/* Colours — real swatches */}
          <div className="form-field full">
            <label>Colours / variants — real swatches, shown as a Colour choice in the Garm App</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {prodForm.colors.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#888888'}
                    onChange={(e) => updateColor(i, { hex: e.target.value })}
                    title="Pick the exact colour"
                    style={{ width: 38, height: 34, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'var(--card)' }} />
                  <input value={c.label} placeholder="Colour name (e.g. Navy)" onChange={(e) => updateColor(i, { label: e.target.value })} style={{ flex: 2 }} />
                  <input value={c.hex} placeholder="#1F2A44" onChange={(e) => updateColor(i, { hex: e.target.value })} style={{ flex: 1, fontFamily: 'monospace' }} maxLength={7} />
                  <button type="button" className="icon-btn btn-sm" title="Remove colour" style={{ width: 32, height: 32 }} onClick={() => setProdForm((f) => ({ ...f, colors: f.colors.filter((_, x) => x !== i) }))}><Icon name="x" /></button>
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" style={{ width: 'fit-content' }} onClick={() => setProdForm((f) => ({ ...f, colors: [...f.colors, { label: '', hex: '#888888' }] }))}><Icon name="plus" /> Add colour</button>
            </div>
          </div>

          {/* Spec fields — the SAME lists the Garm App shows, pre-filled and editable */}
          {prodForm.productType === 'GARMENT' ? (
            <div className="form-field full">
              <label>Garment configurator — the exact lists the Garm App shows for this product</label>
              <div className="small-muted" style={{ marginBottom: 8 }}>
                Pre-filled with the app's built-in options. Remove a chip or add your own — the Garm App shows
                your version immediately; empty a list to fall back to the app's built-in one. Which sections
                customers see (Style / Materials / Sizes) is controlled in <b>Settings → Order Form</b>.
              </div>
              <div className="small-muted" style={{ marginBottom: 8 }}>
                Each fabric, GSM, weave and style can carry its own price \u2014 enter the \u20b9 amount to add to (or
                subtract from) the base price when the customer picks it. The Garm App shows the final \u20b9/pc live.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {([
                  ['Styles', 'styles', 'style', 'Add a style (e.g. Round neck)'],
                  ['Fabrics', 'fabricOptions', 'fabric', 'Add a fabric (e.g. Soft 100% Cotton)'],
                  ['GSM options', 'gsmOptions', 'gsm', 'Add a GSM option (e.g. 180\u2013200 GSM (standard))'],
                  ['Weaves', 'weaveOptions', 'weave', 'Add a weave (e.g. Twill)'],
                ] as const).map(([lbl, key, priceKey, ph]) => (
                  <div key={key}>
                    <div className="small-muted" style={{ fontWeight: 600, marginBottom: 4 }}>{lbl}</div>
                    <PricedListEditor
                      value={prodForm[key]} prices={prodForm.optionPrices[priceKey]} placeholder={ph} base={prodForm.price}
                      onChange={(v) => setProdForm((f) => ({ ...f, [key]: v }))}
                      onPrices={(p) => setProdForm((f) => ({ ...f, optionPrices: { ...f.optionPrices, [priceKey]: p } }))} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-field full">
              <label>Spec options — the dropdowns customers fill for this product in the Garm App</label>
              <div className="small-muted" style={{ marginBottom: 8 }}>
                Edit an option, add or remove fields — the Garm App shows your version immediately. The colour
                swatches above always appear as a Colour choice automatically.
              </div>
              {/* Start from a ready-made template (the same lists the app's
                  built-in categories carry) — then edit. Great for new products
                  or a brand-new category that starts blank. */}
              {Object.keys(specTemplates).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10, padding: 10, border: '1px dashed var(--border)', borderRadius: 10 }}>
                  <span className="small-muted" style={{ fontWeight: 600, marginRight: 2 }}>Start from a template:</span>
                  {Object.keys(specTemplates).map((name) => (
                    <button key={name} type="button" className="btn btn-outline btn-sm"
                      title={`Fill with the ${name} spec fields (${specTemplates[name].map((s) => s.label).join(', ')})`}
                      onClick={() => applySpecTemplate(name)}>{name}</button>
                  ))}
                  {prodForm.specFields.length > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" title="Clear all spec fields"
                      onClick={() => setProdForm((f) => ({ ...f, specFields: [] }))}>Clear all</button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {prodForm.specFields.length === 0 && (
                  <div className="small-muted">No spec fields yet — add the first one below.</div>
                )}
                {prodForm.specFields.map((sf, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={sf.label} placeholder="Field name (e.g. Material)" style={{ flex: 1, fontWeight: 600 }}
                        onChange={(e) => updateSpecField(i, { label: e.target.value })} />
                      <button type="button" className="icon-btn btn-sm" title="Remove this field" style={{ width: 32, height: 32 }}
                        onClick={() => setProdForm((f) => ({ ...f, specFields: f.specFields.filter((_, x) => x !== i) }))}><Icon name="x" /></button>
                    </div>
                    <ListEditor value={sf.options} placeholder={`Add an option (e.g. ${sf.label.trim() || 'Steel'})`}
                      onChange={(opts) => updateSpecFieldOptions(i, opts)} />
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" style={{ width: 'fit-content' }}
                  onClick={() => setProdForm((f) => ({ ...f, specFields: [...f.specFields, { label: '', options: [] }] }))}><Icon name="plus" /> Add spec field</button>
              </div>
            </div>
          )}

          <div className="form-field full">
            <label>Description</label>
            <textarea rows={2} value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} placeholder="Short description shown on the product page" />
          </div>
          <div className="form-field full">
            <label>Product image (primary thumbnail)</label>
            <div className="upload-row">
              <div className="upload-preview">
                {prodForm.image ? <img src={prodForm.image} /> : <div className="upload-placeholder"><Icon name="upload" /></div>}
              </div>
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setProdForm({ ...prodForm, image: await readFileAsDataUrl(file) });
              }} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
