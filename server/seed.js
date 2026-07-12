// Initial seed data for the Garm Admin backend.
// Mirrors the shapes already used by the React admin app (src/data/mockData.ts)
// so swapping the frontend from static mock arrays to live API data is a 1:1 change.

// The category/product names below are copied verbatim from the real Garm
// App's own hand-built catalog (src/app/components/NewOrderTab.tsx —
// `universalAccessoryCategories` and `garmentCatalog`), NOT invented data.
// This is deliberate: the Garm App keeps its own rich catalog (photo
// galleries, per-category spec fields, fabric/GSM options) fully intact, and
// only checks these admin records by NAME to decide whether a category/item
// is currently orderable. Toggling a product's status to INACTIVE here (or
// deleting a category) hides it in the Garm App without touching its code.
const GARM_CATALOG_SOURCE = [
  { label: 'Bottles & Mugs', items: ['Water Bottles', 'Steel Bottles', 'Coffee Mugs', 'Travel Mugs', 'Photo Mugs', 'Name Mugs'] },
  { label: 'ID & Lanyards', items: ['ID Cards', 'ID Tags / Name Badges', 'Lanyards', 'Wrist Bands', 'Event Passes', 'Badges'] },
  { label: 'Office Essentials', items: ['Pens', 'Notebooks', 'Diaries', 'Desk Calendars', 'Name Plates', 'USB Drives', 'Power Banks'] },
  { label: 'Bags & Carry', items: ['Tote Bags', 'Backpacks', 'Laptop Sleeves', 'Laptop Skins', 'Conference Kits', 'Employee Welcome Kits'] },
  { label: 'Awards & Recognition', items: ['Medals', 'Trophies', 'Certificates', 'Awards & Plaques', 'Acrylic Frames', 'Crystal Gifts', 'Wooden Engraved Gifts'] },
  { label: 'Event & Promo', items: ['Banners', 'Standees', 'Stickers', 'Keychains', 'Whistles', 'Corporate Gift Kits', 'Promotional Gift Sets'] },
  { label: 'Photo & Personal Gifts', items: ['Photo Frames', 'LED Photo Frames', 'Cushions', 'Fridge Magnets', 'Wall Clocks', 'LED Name Boards', 'Wooden Name Boards', 'Passport Covers', 'Photo Keychains', 'Name Keychains', 'Gift Boxes', 'Personalised Lamps'] },
  { label: 'Mobile & Tech', items: ['Mobile Cases', 'Car Stickers', 'Bike Stickers', 'Helmet Stickers', 'Wallets'] },
  { label: "Men's Wear", items: [
    { name: 'T-Shirts', price: 190 }, { name: 'Polo T-Shirts', price: 230 }, { name: 'Round Neck T-Shirts', price: 190 }, { name: 'Oversized T-Shirts', price: 240 },
    { name: 'Hoodies', price: 480 }, { name: 'Sweatshirts', price: 420 }, { name: 'Shirts (Formal)', price: 360 }, { name: 'Shirts (Casual)', price: 330 },
    { name: 'Denim Shirts', price: 460 }, { name: 'Jackets', price: 650 }, { name: 'Blazers', price: 1100 }, { name: 'Waistcoats', price: 520 },
    { name: 'Trousers', price: 420 }, { name: 'Chinos', price: 480 }, { name: 'Jeans', price: 560 }, { name: 'Shorts', price: 260 },
    { name: 'Track Pants', price: 360 }, { name: 'Joggers', price: 390 }, { name: 'Uniforms', price: 350 }, { name: 'Lab Coats', price: 420 },
    { name: 'Safety Jackets', price: 480 }, { name: 'Aprons', price: 240 },
  ] },
  { label: "Women's Wear", items: [
    { name: 'T-Shirts', price: 190 }, { name: 'Polo T-Shirts', price: 230 }, { name: 'Shirts', price: 330 }, { name: 'Kurtis', price: 380 },
    { name: 'Kurtas', price: 420 }, { name: 'Leggings', price: 220 }, { name: 'Palazzo Pants', price: 320 }, { name: 'Sarees', price: 750 },
    { name: 'Blouses', price: 260 }, { name: 'Salwar Suits', price: 720 }, { name: 'Churidar Sets', price: 680 }, { name: 'Co-ord Sets', price: 620 },
    { name: 'Tunics', price: 340 }, { name: 'Tops', price: 260 }, { name: 'Dresses', price: 520 }, { name: 'Maxi Dresses', price: 620 },
    { name: 'Gowns', price: 1200 }, { name: 'Hoodies', price: 480 }, { name: 'Sweatshirts', price: 420 }, { name: 'Jackets', price: 620 },
    { name: 'Uniforms', price: 350 }, { name: 'Lab Coats', price: 420 }, { name: 'Aprons', price: 240 },
  ] },
  { label: 'Kids Wear', items: [
    { name: 'T-Shirts', price: 150 }, { name: 'Polo T-Shirts', price: 180 }, { name: 'Shirts', price: 240 }, { name: 'Frocks', price: 360 },
    { name: 'Dresses', price: 340 }, { name: 'Shorts', price: 170 }, { name: 'Track Pants', price: 260 }, { name: 'Joggers', price: 280 },
    { name: 'Hoodies', price: 360 }, { name: 'Sweatshirts', price: 320 }, { name: 'Jackets', price: 440 }, { name: 'Night Suits', price: 320 },
    { name: 'Rompers', price: 280 }, { name: 'Onesies', price: 260 }, { name: 'Lehenga / Skirt Sets', price: 520 }, { name: 'Ethnic Wear (Girls)', price: 420 },
    { name: 'Kurta Sets (Boys)', price: 460 }, { name: 'Ethnic Wear (Boys)', price: 420 },
  ] },
];

// Individuals (B2C) and Organizations (B2B) each get their own independent
// copy of the catalog — separate arrays, separate id sequences — never one
// shared table with a "visible to both" flag. They start out identical
// (both audiences launch with the same product line) but are edited fully
// independently from here on: renaming/pricing/removing a product for
// Organizations has no effect on the Individuals catalog, and vice versa.
// ─── Accessory spec fields — the SAME lists the Garm App ships with built-in
// (Material, Finish, Print/Branding method…), copied here per category so the
// admin portal shows and edits exactly what customers see. Editing a
// product's fields in the portal replaces these in the app for that product.
export const ACCESSORY_SPECS_BY_CATEGORY = {
  'Bottles & Mugs': [
    { label: 'Material', options: ['Stainless Steel (double-wall)', 'Plastic (BPA-free)', 'Ceramic', 'Borosilicate Glass', 'Aluminium', 'Copper'], hint: 'Choose based on usage — steel for insulation, ceramic for mugs' },
    { label: 'Finish', options: ['Matte powder coat', 'Glossy lacquer', 'Brushed steel', 'Transparent / Clear', 'Frosted'] },
    { label: 'Print / Branding method', options: ['Laser engraving', 'UV printing', 'Screen printing', 'Sublimation transfer', 'Embossed logo'] },
  ],
  'ID & Lanyards': [
    { label: 'ID card material', options: ['PVC (standard)', 'PET (eco-friendly)', 'Teslin / Synthetic paper', 'Laminated paper card', 'Metal card (premium)'], hint: 'PVC is most common; Teslin is writable & eco' },
    { label: 'Card finish', options: ['Gloss laminate', 'Matte laminate', 'Holographic overlay', 'Plain (no laminate)'] },
    { label: 'Lanyard material', options: ['Polyester (standard)', 'Nylon (premium)', 'Cotton (eco-friendly)', 'Tubular polyester', 'Not required'] },
    { label: 'Attachment type', options: ['Bulldog clip', 'Retractable reel', 'Safety breakaway buckle', 'Key ring', 'Swivel hook'] },
  ],
  'Office Essentials': [
    { label: 'Pen type', options: ['Ball point', 'Gel ink', 'Roller ball', 'Felt tip', 'Not ordering pens'] },
    { label: 'Notebook / Diary cover', options: ['Hard cover (PU leatherette)', 'Soft cover (PU)', 'Kraft paper cover', 'Cloth / Fabric cover', 'Not ordering notebooks'] },
    { label: 'Branding method', options: ['Debossed logo', 'UV spot printing', 'Full-colour cover print', 'Foil stamping', 'Silkscreen print'] },
  ],
  'Bags & Carry': [
    { label: 'Bag material', options: ['Canvas (cotton)', 'Non-woven PP', 'Jute', 'Ripstop nylon', 'Polyester 600D', 'Recycled PET fabric', 'Genuine / PU leather'], hint: 'Canvas & jute for eco branding; nylon for durability' },
    { label: 'Stitching & finishing', options: ['Single-needle flat seam', 'Double-needle reinforced', 'Heat-sealed seams', 'Overlock finish'] },
    { label: 'Closure type', options: ['Zip closure', 'Magnetic snap', 'Button snap', 'Open top (tote)', 'Drawstring'] },
    { label: 'Branding method', options: ['Screen printing', 'Embroidery patch', 'Woven label', 'Sublimation print', 'Heat transfer'] },
  ],
  'Awards & Recognition': [
    { label: 'Award material', options: ['Crystal / K9 glass', 'Acrylic', 'Metal (zinc alloy)', 'Wooden (teak / MDF)', 'Marble / Stone resin', 'Glass'], hint: 'Crystal for premium events; acrylic for budget-friendly' },
    { label: 'Engraving / Print method', options: ['Laser engraving', 'UV colour printing', 'Gold / Silver foiling', 'Sand blasting', 'Embossed plate'] },
    { label: 'Base / Stand type', options: ['Wooden base', 'Metal base', 'Integrated (no separate base)', 'Acrylic base'] },
  ],
  'Event & Promo': [
    { label: 'Primary item type', options: ['Flex / Vinyl banner', 'Fabric pull-up standee', 'Stickers (vinyl)', 'Stickers (paper)', 'Keychain (metal)', 'Keychain (acrylic)', 'Gift kit assembly'] },
    { label: 'Print method', options: ['Digital solvent print', 'UV flatbed print', 'Sublimation', 'Screen print', 'Offset print'] },
    { label: 'Keychain material (if applicable)', options: ['Zinc alloy / Die-cast metal', 'Acrylic', 'Rubber / PVC', 'Genuine leather', 'Not ordering keychains'] },
  ],
  'Photo & Personal Gifts': [
    { label: 'Primary item', options: ['Photo frame (wooden)', 'Photo frame (acrylic)', 'LED photo frame', 'Cushion (sublimated)', 'Wall clock (acrylic)', 'LED name board', 'Wooden name board', 'Fridge magnet'] },
    { label: 'Print / Branding method', options: ['Sublimation transfer', 'UV direct print', 'Laser engraving', 'Screen print'] },
    { label: 'Photo source', options: ["We'll provide digital photos", 'Need photographer / design help', 'Template design only'] },
  ],
  'Mobile & Tech': [
    { label: 'Primary item', options: ['Mobile case (hard shell)', 'Mobile case (soft TPU)', 'Laptop skin (vinyl)', 'Car sticker (vinyl)', 'Bike / Helmet sticker'] },
    { label: 'Print method', options: ['UV direct print', 'Sublimation', 'Digital cut vinyl', 'Screen print'] },
    { label: 'Device specification', options: ['Provide device model list separately', 'Standard sizes (A5 / A4 sheets)', 'Coordinator to confirm sizes'] },
  ],
};

// ─── Garment configuration — ported 1:1 from the Garm App's built-in
// configurator (styles per garment, fabric/GSM options, weave list, colour
// palette) so every garment product arrives PRE-FILLED with exactly what
// customers see today. Edit any list in the portal and the app shows your
// version; empty lists fall back to the app's built-ins. ───────────────────
const GARMENT_WEAVES = ['Plain', 'Twill', 'Jersey knit', 'Pique', 'Custom'];

const GARMENT_FABRIC_MAP = {
  school_uniform: { fabricOptions: ['100% Cotton Pique', 'Cotton-Poly Blend', 'Oxford Cotton', '100% Polyester'], gsmOptions: ['160–180 GSM (polo)', '180–220 GSM (shirts)', '240–280 GSM (blazers)'] },
  tshirt: { fabricOptions: ['Soft 100% Cotton', 'Cotton-Poly Blend', 'Dri-fit Polyester', 'Slub Cotton', 'Bamboo Blend'], gsmOptions: ['140–160 GSM (lightweight)', '180–200 GSM (standard)', '220–240 GSM (premium)'] },
  shirt: { fabricOptions: ['Oxford Cotton', 'Poplin Cotton', 'Linen Blend', 'Cotton-Poly (easy care)', 'Rayon / Viscose'], gsmOptions: ['120–140 GSM (summer)', '160–180 GSM (standard)', '200–220 GSM (formal)'] },
  polo: { fabricOptions: ['100% Cotton Pique', 'Dri-fit Pique', 'Micro Pique', 'Cotton-Poly Pique'], gsmOptions: ['170–190 GSM (lightweight polo)', '200–220 GSM (standard)', '240–260 GSM (premium)'] },
  hoodie: { fabricOptions: ['Fleece (80/20 cotton-poly)', 'French Terry', 'Heavy GSM Fleece', 'Sherpa lined fleece'], gsmOptions: ['240–280 GSM (light hoodie)', '300–340 GSM (standard)', '360–400 GSM (heavyweight)'] },
  sportswear: { fabricOptions: ['Dri-fit Polyester', 'Mesh knit', 'Compression spandex blend', 'Microfibre performance'], gsmOptions: ['100–130 GSM (jersey / singlet)', '160–180 GSM (training wear)', '200–240 GSM (track pants)'] },
  dress: { fabricOptions: ['100% Cotton', 'Linen Blend', 'Rayon / Viscose', 'Georgette', 'Cotton-Spandex'], gsmOptions: ['100–130 GSM (light summer)', '140–160 GSM (standard)', '180–200 GSM (structured)'] },
  formal: { fabricOptions: ['Wool Blend', '100% Polyester (suit)', 'Oxford Cotton (shirt)', 'Satin-finish poly', 'Linen Blend'], gsmOptions: ['180–200 GSM (shirts)', '240–280 GSM (trousers)', '300–360 GSM (blazers)'] },
};

export function garmentMaterialsFor(name) {
  const n = name.toLowerCase();
  const pick = (k) => ({ ...GARMENT_FABRIC_MAP[k], weaveOptions: [...GARMENT_WEAVES] });
  if (/hoodie|sweatshirt/.test(n)) return pick('hoodie');
  if (/polo/.test(n)) return pick('polo');
  if (/t-?shirt|tee\b|oversized|round neck/.test(n)) return pick('tshirt');
  if (/blazer|waistcoat|formal|trouser|chino/.test(n)) return pick('formal');
  if (/shirt|blouse/.test(n)) return pick('shirt');
  if (/track|jogger|jersey|short|legging/.test(n)) return pick('sportswear');
  if (/dress|frock|gown|kurti|kurta|saree|tunic|top|palazzo/.test(n)) return pick('dress');
  if (/uniform|lab coat|apron|scrub|safety/.test(n)) return pick('school_uniform');
  return pick('tshirt');
}

export function garmentStylesFor(name) {
  const n = name.toLowerCase();
  if (/polo/.test(n)) return ['Classic collar', 'Tipped collar', 'Zip placket', 'Mandarin collar'];
  if (/oversized/.test(n)) return ['Drop shoulder', 'Boxy fit', 'Longline'];
  if (/round neck/.test(n)) return ['Round neck', 'Crew neck', 'Raglan sleeve'];
  if (/t-?shirt|tee\b/.test(n)) return ['Round neck', 'V-neck', 'Henley', 'Collared (polo)', 'Raglan sleeve'];
  if (/denim shirt/.test(n)) return ['Plain', 'Washed', 'Double pocket'];
  if (/formal.*shirt|shirt.*formal/.test(n)) return ['Slim fit', 'Regular fit', 'Full sleeve', 'Half sleeve', 'Cutaway collar', 'Mandarin collar'];
  if (/casual.*shirt|shirt.*casual/.test(n)) return ['Plain', 'Printed', 'Checked', 'Korean fit (boxy)', 'Half sleeve', 'Mandarin collar'];
  if (/night suit/.test(n)) return ['Shirt + pyjama', 'Tee + shorts', 'Full sleeve set'];
  if (/\bshirt|blouse/.test(n)) return ['Formal', 'Semi-formal', 'Slim fit', 'Regular fit', 'Printed', 'Plain'];
  if (/\btops?\b/.test(n)) return ['Regular fit', 'Crop', 'Peplum', 'Sleeveless'];
  if (/jeans/.test(n)) return ['Slim fit', 'Straight fit', 'Regular fit', 'Relaxed fit', 'Skinny', 'Baggy / wide leg', 'Korean fit (tapered)'];
  if (/chino|trouser/.test(n)) return ['Formal', 'Slim fit', 'Regular fit', 'Korean fit (tapered)', 'Baggy / relaxed', 'Pleated', 'Flat front'];
  if (/legging/.test(n)) return ['Ankle length', 'Full length', 'Churidar'];
  if (/short/.test(n)) return ['Regular fit', 'Cargo', 'Bermuda', 'Baggy fit'];
  if (/track ?pant|jogger/.test(n)) return ['Regular fit', 'Slim fit', 'Cuffed ankle', 'Baggy fit'];
  if (/palazzo/.test(n)) return ['Flared', 'Straight', 'Culotte'];
  if (/hoodie/.test(n)) return ['Pullover', 'Zip-up', 'Oversized fit'];
  if (/sweatshirt/.test(n)) return ['Crew neck', 'Hooded', 'Oversized fit'];
  if (/safety jacket/.test(n)) return ['Sleeveless vest', 'Full sleeve', 'With hood'];
  if (/blazer|waistcoat/.test(n)) return ['Single-breasted', 'Double-breasted', 'Slim fit', 'Regular fit'];
  if (/jacket/.test(n)) return ['Bomber', 'Denim', 'Windcheater', 'Varsity'];
  if (/saree/.test(n)) return ['Plain', 'Zari border', 'Printed', 'Embroidered'];
  if (/salwar/.test(n)) return ['Straight cut', 'A-line', 'Anarkali'];
  if (/churidar/.test(n)) return ['Classic', 'Anarkali', 'Straight cut'];
  if (/kurta set/.test(n)) return ['Kurta + pyjama', 'Kurta + churidar', 'With jacket'];
  if (/ethnic.*girl/.test(n)) return ['Lehenga choli', 'Anarkali', 'Sharara set'];
  if (/ethnic.*boy/.test(n)) return ['Kurta pyjama', 'Sherwani style', 'Dhoti set'];
  if (/kurti|kurta|tunic/.test(n)) return ['Straight', 'A-line', 'Anarkali'];
  if (/lehenga|skirt/.test(n)) return ['Flared', 'A-line', 'Layered'];
  if (/gown/.test(n)) return ['A-line', 'Ball gown', 'Mermaid', 'Straight'];
  return [];
}

// The SAME colour palette the app's garment picker shows customers.
const GARMENT_PALETTE = [
  { label: 'Black', hex: '#111111' }, { label: 'White', hex: '#ffffff' },
  { label: 'Light Grey', hex: '#e5e5e5' }, { label: 'Navy Blue', hex: '#1a2540' },
  { label: 'Red', hex: '#d4394a' }, { label: 'Forest Green', hex: '#2d5a3d' },
  { label: 'Golden', hex: '#c8a84b' }, { label: 'Burgundy', hex: '#8b3a3a' },
];

// Every product ships with real colour variants as {label, hex} swatches —
// never bare text — so the Garm App and the admin portal can render them.
const GARMENT_COLORS = [
  { label: 'Black', hex: '#0D0D0D' }, { label: 'White', hex: '#FFFFFF' },
  { label: 'Navy', hex: '#1F2A44' }, { label: 'Grey', hex: '#9CA3AF' },
];
const ACCESSORY_COLORS = [
  { label: 'Black', hex: '#0D0D0D' }, { label: 'White', hex: '#FFFFFF' },
  { label: 'Blue', hex: '#2563EB' }, { label: 'Red', hex: '#DC2626' },
];

function buildGarmCatalog(audience) {
  const categories = [];
  const products = [];
  let categoryId = 1;
  let productId = 1;
  for (const cat of GARM_CATALOG_SOURCE) {
    const catId = categoryId++;
    categories.push({ id: catId, audience, name: cat.label, image: null, description: '' });
    for (const item of cat.items) {
      const isObj = typeof item === 'object';
      products.push({
        id: productId++,
        audience,
        name: isObj ? item.name : item,
        categoryId: catId,
        // Garment items (isObj) carry the full garment spec; everything else
        // in the hand-built catalog is an accessory/promo item.
        productType: isObj ? 'GARMENT' : 'ACCESSORY',
        inStock: true,
        // Accessories start with the SAME spec lists the Garm App shows
        // (Material / Finish / Print method…) so the admin sees and edits
        // exactly what customers see — never an empty form.
        specFields: isObj ? [] : JSON.parse(JSON.stringify(ACCESSORY_SPECS_BY_CATEGORY[cat.label] ?? [])),
        price: isObj ? item.price : 0,
        sizes: isObj ? ['S', 'M', 'L', 'XL'] : [],
        colors: isObj ? JSON.parse(JSON.stringify(GARMENT_PALETTE)) : [...ACCESSORY_COLORS],
        styles: isObj ? garmentStylesFor(item.name) : [],
        weaveOptions: isObj ? [...GARMENT_WEAVES] : [],
        moq: isObj ? 50 : 100,
        status: 'ACTIVE',
        image: null,
        // Spec fields — empty by default here (garment items, isObj===true,
        // are the ones where material/GSM/stitching/packaging/logo-upload are
        // actually relevant); admin fills these in per product as needed.
        description: '',
        gallery: [],
        fabricOptions: isObj ? garmentMaterialsFor(item.name).fabricOptions : [],
        gsmOptions: isObj ? garmentMaterialsFor(item.name).gsmOptions : [],
        stitchingOptions: [],
        packagingOptions: [],
        allowsLogoUpload: isObj,
      });
    }
  }
  return { categories, products, nextCategoryId: categoryId, nextProductId: productId };
}

export function buildSeed() {
  const b2c = buildGarmCatalog('B2C');
  const b2b = buildGarmCatalog('B2B');

  return {
    meta: {
      nextOrderSeq: 11,
      nextCategoryIdB2C: b2c.nextCategoryId, nextProductIdB2C: b2c.nextProductId,
      nextCategoryIdB2B: b2b.nextCategoryId, nextProductIdB2B: b2b.nextProductId,
      nextUserId: 6, nextCustomerId: 1, nextQuoteId: 1, nextAddrSeq: 1, nextPayMethodSeq: 1,
    },

    // Garm App customers (individuals + organisations) — separate from the
    // admin `users` above. Populated by real OTP sign-ups; starts empty.
    customers: [],
    otps: [],
    sessions: [],
    adminSessions: [],
    quotes: [],

    // Customer-facing tracking stage labels — matches each order.status value
    // 1:1 (key is fixed, only label/sub are admin-editable). Used to be
    // hardcoded in index.js with no admin visibility; see PUT /api/track-stages.
    // `orgOnly` stages are skipped entirely for Individual (B2C) orders — the
    // Garm App never puts individual orders through in-house QC, only bulk
    // Organisation (B2B) manufacturing runs go through inspection before
    // invoicing. See buildTrackSteps() in index.js for the filtering.
    trackStages: [
      { key: 'NEW', label: 'Order submitted', sub: "We've got your order" },
      // B2C acceptance gate: an individual's order must be confirmed by the
      // admin team before the customer sees the confirmation + can pay.
      // Organisations go through quote approval instead, never this stage.
      { key: 'CONFIRMED', label: 'Order confirmed', sub: 'Confirmed by Garm — payment unlocked', b2cOnly: true },
      { key: 'PAID', label: 'Payment received', sub: 'Thank you!' },
      { key: 'ASSIGNED', label: 'Assigned to manufacturer', sub: 'Production partner confirmed' },
      { key: 'IN_PROGRESS', label: 'In production', sub: 'Your garments are being made' },
      { key: 'QC_READY', label: 'Quality check', sub: 'Inspecting for defects', orgOnly: true },
      { key: 'QC_APPROVED', label: 'Quality approved', sub: 'Passed inspection', orgOnly: true },
      { key: 'INVOICED', label: 'Invoiced', sub: 'Invoice generated', orgOnly: true },
      { key: 'SHIPPED', label: 'Shipped', sub: 'On the way to you' },
      { key: 'DELIVERED', label: 'Delivered', sub: 'Order complete' },
    ],

    // App-wide settings — Feature Toggles + Company/billing details, both
    // previously local-only mock state in Settings.tsx with no persistence.
    settings: {
      features: [
        { key: 'b2b_orders', name: 'B2B Orders', desc: 'Allow organizations to place bulk orders', on: true },
        { key: 'b2c_orders', name: 'B2C Orders', desc: 'Allow individual customers to order via Garm App', on: true },
        { key: 'qc_workflow', name: 'QC Workflow', desc: 'Require quality inspection before invoicing', on: true },
        { key: 'payment_gateway', name: 'Payment Gateway Integration', desc: 'Enable Stripe / Razorpay online payments', on: true },
        { key: 'email_notifications', name: 'Email Notifications', desc: 'Send order & invoice emails automatically', on: true },
        { key: 'sms_notifications', name: 'SMS Notifications', desc: 'Send order status updates via SMS', on: false },
        { key: 'whatsapp_integration', name: 'WhatsApp Integration', desc: 'Send order updates via WhatsApp Business', on: false },
      ],
      // Garm App order-form configuration — which sections of the custom
      // order flow customers see. Toggled from Settings → Garm App Order Form;
      // the app reads this live (public /api/garm/order-config).
      // Service fee applied to every order's payable amount — configurable
      // per customer type, with a lower slab for large bulk orders and a
      // minimum fee for tiny orders. Shown as its own line in price details
      // in the Garm App AND the admin portal.
      serviceFee: {
        // Standard profitable margins for made-to-order work. Individuals pay
        // a higher rate — 1–2 pc custom orders carry the full coordination and
        // production-setup cost; the ₹ floor makes even a single piece viable.
        // Organisations pay less per piece because volume absorbs the fixed
        // cost, with a further bulk slab at scale. All editable in
        // Settings → Order Form → Service Fee.
        b2cPercent: 15,        // Individuals — % of order value
        b2cPerPiece: 49,       // Individuals — ₹ per PIECE on top (each piece
                               // carries its own handling/production cost, so
                               // 2–3 pc orders pay more than 1 pc)
        b2bPercent: 8,         // Organisations
        bulkQtyThreshold: 500, // orders at/above this many pieces get the bulk rate
        bulkPercent: 5,        // Organisations, bulk slab
        minFee: 99,            // ₹ floor — a 1 pc order still earns a real margin
        surplusDiscountPercent: 15, // Surplus (mill leftover) fabric — % off the garment rate
        orgAdvancePercent: 30, // Organisations pay this % advance (production starts);
                               // the balance is due after the QC report.
      },
      orderForm: {
        style: true,          // per-garment style options (round neck, collared…)
        materials: true,      // Material step (fabric, GSM weight, weave)
        sizes: true,          // Sizes step (per-size quantity breakdown)
        referenceUpload: true, // References & samples step (logo/design upload)
        livePreview: true,    // live garment mockup preview
      },
      // "Your procurement manager" card in the Garm App. The name shown is
      // overridden per order by order.assignedEmployee when an admin assigns
      // an employee; phone/WhatsApp/email below are company-wide and stay the
      // same for every order, always.
      coordinator: {
        name: 'Priya Raman',
        role: 'Owns quote, mill follow-up, QA and delivery',
        phone: '+91 98400 12345',
        whatsapp: '+91 98400 12345',
        email: 'support@garm.com',
      },
      company: {
        gstNumber: '33AAAAA0000A1Z5',
        placeOfSupply: 'Tamil Nadu',
        bankAccountHolder: 'Garm Manufacturing Pvt. Ltd.',
        accountNumber: '5021 0043 8812',
        ifscCode: 'HDFC0000452',
        smtpEmail: 'billing@garm.com',
        paymentGatewayKey: '',
        paymentTerms: 'Due within 30 days',
      },
    },

    users: [
      { id: 1, name: 'Haneef M.', email: 'haneef@garm.com', role: 'Super Admin', status: 'Active', lastLogin: null },
      { id: 2, name: 'Divya Raghavan', email: 'divya@garm.com', role: 'Operations Manager', status: 'Active', lastLogin: null },
      { id: 3, name: 'Meena Rajan', email: 'meena@garm.com', role: 'QC Supervisor', status: 'Active', lastLogin: null },
      { id: 4, name: 'Arjun Nair', email: 'arjun@garm.com', role: 'Finance Manager', status: 'Invited', lastLogin: null },
      { id: 5, name: 'Karthik Subramaniam', email: 'karthik@garm.com', role: 'Warehouse Manager', status: 'Active', lastLogin: null },
    ],

    categoriesB2C: b2c.categories,
    productsB2C: b2c.products,
    categoriesB2B: b2b.categories,
    productsB2B: b2b.products,

    manufacturers: [
      { id: 1, name: 'ABC Garments', city: 'Tiruppur, TN', cats: ['Shirts', 'Pants'], certs: ['ISO 9001', 'OEKO-TEX'], cap: 5000, lead: 7, onTime: 95, qc: 92, status: 'ACTIVE', rating: 4.8 },
      { id: 2, name: 'Vogue Textiles', city: 'Surat, GJ', cats: ['Shirts', 'Accessories'], certs: ['Fair Trade'], cap: 3200, lead: 10, onTime: 89, qc: 87, status: 'ACTIVE', rating: 4.4 },
      { id: 3, name: 'Sunrise Apparel', city: 'Ludhiana, PB', cats: ['Pants', 'Jackets'], certs: ['ISO 9001'], cap: 6400, lead: 9, onTime: 91, qc: 90, status: 'ACTIVE', rating: 4.6 },
      { id: 4, name: 'Coral Weaves', city: 'Kolkata, WB', cats: ['Shirts'], certs: [], cap: 1800, lead: 12, onTime: 82, qc: 85, status: 'ON_HOLD', rating: 3.9 },
      { id: 5, name: 'Meridian Textiles', city: 'Ahmedabad, GJ', cats: ['Accessories'], certs: ['OEKO-TEX'], cap: 2500, lead: 8, onTime: 96, qc: 94, status: 'ACTIVE', rating: 4.9 },
      { id: 6, name: 'Prestige Fabrics', city: 'Jaipur, RJ', cats: ['Pants', 'Shirts'], certs: [], cap: 4000, lead: 11, onTime: 78, qc: 80, status: 'INACTIVE', rating: 3.5 },
    ],

    // Orders + quotes no longer live in this file store — they're read
    // straight from the same MongoDB the Garm App's own backend
    // (Latest version of FAB/backend) writes to. See server/mongo.js.
  };
}
