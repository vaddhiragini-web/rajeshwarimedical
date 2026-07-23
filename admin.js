// ============================================================================
// ADMIN CONSOLE — admin.html loads this file (<script type="module" src="admin.js">).
// Reuses the SAME Firebase + Supabase project as the customer store (store.js)
// so orders/products stay in sync between the two apps in real time.
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDDwC_AojbttZKz9LmKk-7wH46yS6cq9Ic",
  authDomain: "rajeshwarimedical-78b78.firebaseapp.com",
  projectId: "rajeshwarimedical-78b78",
  storageBucket: "rajeshwarimedical-78b78.firebasestorage.app",
  messagingSenderId: "818567753854",
  appId: "1:818567753854:web:65509e76ac464cfcf0282f",
  measurementId: "G-0CJJHQKZWS",
};

const SUPABASE_URL = "https://eqqxjfzokwqsamznvikb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcXhqZnpva3dxc2Ftem52aWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDI2MTIsImV4cCI6MjEwMDM3ODYxMn0.dOcs7w0B7Iw99B4-sXbi1ZLas08hg3xUrrkYyUuN3Po";

// Where the "Logout" button should send the admin back to.
// Adjust to whatever your customer-facing store file is actually named.
const STORE_URL = "index.html";

// Firestore doc that controls the customer-facing "site is live" switch.
// store.js can read this same doc (settings/site -> field "live") to show a
// closed banner to customers — wire that up on the customer side if not
// already done.
const SETTINGS_DOC_PATH = ["settings", "site"];

// ============================================================================
// Element refs
// ============================================================================
const tabsNav = document.getElementById("admin-tabs");
const panels = {
  stats: document.getElementById("panel-stats"),
  orders: document.getElementById("panel-orders"),
  products: document.getElementById("panel-products"),
  settings: document.getElementById("panel-settings"),
};

const backendWarning = document.getElementById("admin-backend-warning");
const logoutBtn = document.getElementById("admin-logout-btn");

const statTotalOrders = document.getElementById("stat-total-orders");
const statPendingOrders = document.getElementById("stat-pending-orders");
const statFulfilledOrders = document.getElementById("stat-fulfilled-orders");
const statTotalRevenue = document.getElementById("stat-total-revenue");

const liveDot = document.getElementById("live-dot");
const liveText = document.getElementById("live-text");
const siteLiveToggle = document.getElementById("site-live-toggle");
const liveDot2 = document.getElementById("live-dot-2");
const liveText2 = document.getElementById("live-text-2");
const siteLiveToggle2 = document.getElementById("site-live-toggle-2");

const ordersCountTitle = document.getElementById("orders-count-title");
const ordersTableBody = document.getElementById("orders-table-body");

const productForm = document.getElementById("product-form");
const pIdField = document.getElementById("p-id");
const pName = document.getElementById("p-name");
const pCategory = document.getElementById("p-category");
const pPrice = document.getElementById("p-price");
const pStock = document.getElementById("p-stock");
const pImage = document.getElementById("p-image");
const productSubmitBtn = document.getElementById("product-submit-btn");
const productCancelBtn = document.getElementById("product-cancel-btn");
const productFormError = document.getElementById("product-form-error");
const productsTableBody = document.getElementById("products-table-body");

const connectPrinterBtn = document.getElementById("connect-printer-btn");

// ============================================================================
// Backend handles — every function checks for null first, so a slow/failed
// backend never blocks the tabs, forms, or toggles from rendering.
// ============================================================================
let db = null;
let supabaseClient = null;
let firebaseFns = null; // { collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy, setDoc, getDoc }

let latestOrders = [];
let latestProducts = [];
let productsChannel = null;
let printerPort = null; // Web Serial port, once connected

function showBackendWarning(message) {
  if (!backendWarning) return;
  backendWarning.textContent = message;
  backendWarning.hidden = false;
}
function clearBackendWarning() {
  if (!backendWarning) return;
  backendWarning.hidden = true;
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ============================================================================
// Tabs
// ============================================================================
tabsNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".admin-tab");
  if (!btn) return;
  const tab = btn.dataset.tab;

  tabsNav.querySelectorAll(".admin-tab").forEach((b) => b.classList.toggle("active", b === btn));
  Object.entries(panels).forEach(([name, panel]) => {
    panel.hidden = name !== tab;
  });
});

// ============================================================================
// Logout
// ============================================================================
logoutBtn.addEventListener("click", () => {
  if (ordersUnsubscribe) ordersUnsubscribe();
  if (settingsUnsubscribe) settingsUnsubscribe();
  if (productsChannel) supabaseClient?.removeChannel(productsChannel);
  window.location.href = STORE_URL;
});

// ============================================================================
// Backend init
// ============================================================================
async function initBackend() {
  try {
    if (!window.supabase) throw new Error("Supabase library did not load.");
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Supabase init failed:", err);
    supabaseClient = null;
  }

  try {
    const [{ initializeApp }, firestoreMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
    ]);
    const firebaseApp = initializeApp(firebaseConfig);
    db = firestoreMod.getFirestore(firebaseApp);
    firebaseFns = {
      collection: firestoreMod.collection,
      doc: firestoreMod.doc,
      addDoc: firestoreMod.addDoc,
      updateDoc: firestoreMod.updateDoc,
      setDoc: firestoreMod.setDoc,
      getDoc: firestoreMod.getDoc,
      onSnapshot: firestoreMod.onSnapshot,
      query: firestoreMod.query,
      orderBy: firestoreMod.orderBy,
    };
  } catch (err) {
    console.error("Firebase init failed:", err);
    db = null;
    firebaseFns = null;
  }

  if (!supabaseClient && !db) {
    showBackendWarning("Store backend is unavailable right now — orders and products won't update.");
  } else if (!supabaseClient) {
    showBackendWarning("Product catalog is temporarily unavailable — please refresh in a moment.");
  } else if (!db) {
    showBackendWarning("Orders are temporarily unavailable — you can still manage products.");
  } else {
    clearBackendWarning();
  }

  if (db && firebaseFns) {
    listenToOrders();
    listenToSiteLive();
  }
  if (supabaseClient) {
    listenToProducts();
  }
}
initBackend();

// ============================================================================
// ORDERS — real-time via Firestore onSnapshot
// ============================================================================
let ordersUnsubscribe = null;

function listenToOrders() {
  const ordersQuery = firebaseFns.query(
    firebaseFns.collection(db, "orders"),
    firebaseFns.orderBy("createdAt", "desc")
  );

  ordersUnsubscribe = firebaseFns.onSnapshot(
    ordersQuery,
    (snapshot) => {
      latestOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderStats(latestOrders);
      renderOrdersTable(latestOrders);
    },
    (err) => {
      ordersTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Couldn't load orders: ${escapeHtml(err.message)}</td></tr>`;
    }
  );
}

function renderStats(orders) {
  const total = orders.length;
  const pending = orders.filter((o) => (o.status || "pending") === "pending").length;
  const fulfilled = orders.filter((o) => ["fulfilled", "delivered"].includes(o.status)).length;
  const revenue = orders
    .filter((o) => ["fulfilled", "delivered"].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  statTotalOrders.textContent = total;
  statPendingOrders.textContent = pending;
  statFulfilledOrders.textContent = fulfilled;
  statTotalRevenue.textContent = `₹${revenue.toFixed(2)}`;
}

function renderOrdersTable(orders) {
  ordersCountTitle.textContent = `All recent orders (${orders.length} total)`;

  if (orders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">No orders yet.</td></tr>`;
    return;
  }

  ordersTableBody.innerHTML = orders
    .map((o) => {
      const shortId = o.id.slice(0, 8);
      const when = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString() : "Just now";
      const itemsSummary = Array.isArray(o.items) ? o.items.map((i) => `${i.name} ×${i.qty}`).join(", ") : "—";
      const status = o.status || "pending";

      return `
        <tr data-id="${o.id}">
          <td>${shortId}</td>
          <td>${when}</td>
          <td>${escapeHtml(o.customerName || "—")}</td>
          <td>${escapeHtml(o.customerPhone || "—")}</td>
          <td>${escapeHtml(itemsSummary)}</td>
          <td>₹${Number(o.total || 0).toFixed(2)}</td>
          <td><span class="status-pill ${status}">${status}</span></td>
          <td>${orderActionsHtml(status)}</td>
        </tr>`;
    })
    .join("");

  ordersTableBody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      updateOrderStatus(row.dataset.id, btn.dataset.action);
    });
  });
}

function orderActionsHtml(status) {
  if (status === "pending") {
    return `
      <button type="button" class="btn btn-primary" data-action="accepted" style="padding:8px 14px;font-size:13px;">Accept</button>
      <button type="button" class="btn btn-ghost" data-action="cancelled" style="padding:8px 14px;font-size:13px;">Cancel</button>`;
  }
  if (status === "accepted") {
    return `
      <button type="button" class="btn btn-primary" data-action="fulfilled" style="padding:8px 14px;font-size:13px;">Mark Fulfilled</button>
      <button type="button" class="btn btn-ghost" data-action="cancelled" style="padding:8px 14px;font-size:13px;">Cancel</button>`;
  }
  return "";
}

async function updateOrderStatus(orderId, status) {
  if (!db || !firebaseFns) return;
  try {
    await firebaseFns.updateDoc(firebaseFns.doc(db, "orders", orderId), { status });
  } catch (err) {
    alert("Couldn't update order: " + err.message);
  }
}

// ============================================================================
// SITE LIVE TOGGLE — Firestore doc, synced in real time to BOTH switches
// (Orders tab + Settings tab) and to every admin session that has this open.
// ============================================================================
let settingsUnsubscribe = null;
let applyingRemoteToggle = false;

function listenToSiteLive() {
  const settingsRef = firebaseFns.doc(db, ...SETTINGS_DOC_PATH);

  settingsUnsubscribe = firebaseFns.onSnapshot(
    settingsRef,
    (snap) => {
      const live = snap.exists() ? snap.data().live !== false : true;
      applyingRemoteToggle = true;
      setToggleUI(live);
      applyingRemoteToggle = false;
    },
    (err) => console.error("Settings listener failed:", err)
  );
}

function setToggleUI(live) {
  siteLiveToggle.checked = live;
  siteLiveToggle2.checked = live;
  [liveDot, liveDot2].forEach((dot) => (dot.style.background = live ? "#27c94b" : "#d32f2f"));
  liveText.textContent = live ? "Site LIVE" : "Site CLOSED";
  liveText2.textContent = live ? "Site LIVE" : "Site CLOSED";
}

async function writeSiteLive(live) {
  if (!db || !firebaseFns) return;
  try {
    await firebaseFns.setDoc(firebaseFns.doc(db, ...SETTINGS_DOC_PATH), { live }, { merge: true });
  } catch (err) {
    alert("Couldn't update site status: " + err.message);
  }
}

[siteLiveToggle, siteLiveToggle2].forEach((toggle) => {
  toggle.addEventListener("change", () => {
    if (applyingRemoteToggle) return;
    writeSiteLive(toggle.checked);
  });
});

// ============================================================================
// PRODUCTS — Supabase, real-time via postgres_changes channel
// (Enable Realtime replication on the "products" table in the Supabase
// dashboard if changes aren't syncing live.)
// ============================================================================
function listenToProducts() {
  loadProducts();

  productsChannel = supabaseClient
    .channel("products-admin-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
      loadProducts();
    })
    .subscribe();
}

async function loadProducts() {
  const { data, error } = await supabaseClient.from("products").select("*").order("name", { ascending: true });
  if (error) {
    productsTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">Couldn't load products: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  latestProducts = data || [];
  renderProductsTable(latestProducts);
}

function renderProductsTable(products) {
  if (products.length === 0) {
    productsTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">No products yet — add one above.</td></tr>`;
    return;
  }

  productsTableBody.innerHTML = products
    .map(
      (p) => `
        <tr data-id="${p.id}">
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.category || "—")}</td>
          <td>₹${Number(p.price).toFixed(2)}</td>
          <td>${p.stock}</td>
          <td>
            <button type="button" class="btn btn-ghost" data-action="edit" style="padding:8px 14px;font-size:13px;">Edit</button>
            <button type="button" class="btn btn-ghost" data-action="delete" style="padding:8px 14px;font-size:13px;">Delete</button>
          </td>
        </tr>`
    )
    .join("");

  productsTableBody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("tr").dataset.id;
      const product = latestProducts.find((p) => String(p.id) === String(id));
      if (product) startEditProduct(product);
    });
  });
  productsTableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("tr").dataset.id;
      if (confirm("Delete this product?")) deleteProduct(id);
    });
  });
}

function startEditProduct(product) {
  pIdField.value = product.id;
  pName.value = product.name || "";
  pCategory.value = product.category || "";
  pPrice.value = product.price ?? "";
  pStock.value = product.stock ?? "";
  pImage.value = product.image_url || "";
  productSubmitBtn.textContent = "Update Product";
  productCancelBtn.hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetProductForm() {
  productForm.reset();
  pIdField.value = "";
  productSubmitBtn.textContent = "Add Product";
  productCancelBtn.hidden = true;
  productFormError.hidden = true;
}

productCancelBtn.addEventListener("click", resetProductForm);

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  productFormError.hidden = true;

  if (!supabaseClient) {
    productFormError.textContent = "Product catalog is unavailable right now.";
    productFormError.hidden = false;
    return;
  }

  const payload = {
    name: pName.value.trim(),
    category: pCategory.value.trim() || null,
    price: Number(pPrice.value),
    stock: Number(pStock.value),
    image_url: pImage.value.trim() || null,
  };

  if (!payload.name || Number.isNaN(payload.price) || Number.isNaN(payload.stock)) {
    productFormError.textContent = "Please fill in name, price, and stock correctly.";
    productFormError.hidden = false;
    return;
  }

  productSubmitBtn.disabled = true;
  try {
    const editingId = pIdField.value;
    const { error } = editingId
      ? await supabaseClient.from("products").update(payload).eq("id", editingId)
      : await supabaseClient.from("products").insert(payload);

    if (error) throw error;
    resetProductForm();
    loadProducts();
  } catch (err) {
    productFormError.textContent = "Couldn't save product: " + err.message;
    productFormError.hidden = false;
  } finally {
    productSubmitBtn.disabled = false;
  }
});

async function deleteProduct(id) {
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) alert("Couldn't delete product: " + error.message);
  else loadProducts();
}

// ============================================================================
// CONNECT PRINTER — Web Serial API (Chrome/Edge only) for USB thermal
// receipt printers. This wires up the connection only; add your printer's
// ESC/POS byte commands in printReceipt() once you know the exact model.
// ============================================================================
connectPrinterBtn.addEventListener("click", async () => {
  if (!("serial" in navigator)) {
    alert("This browser doesn't support connecting to a printer directly (try Chrome or Edge on desktop).");
    return;
  }
  try {
    printerPort = await navigator.serial.requestPort();
    await printerPort.open({ baudRate: 9600 });
    connectPrinterBtn.textContent = "🖶 Printer Connected";
    connectPrinterBtn.disabled = true;
  } catch (err) {
    if (err.name !== "NotFoundError") {
      alert("Couldn't connect to printer: " + err.message);
    }
  }
});

// Example helper for later use once ESC/POS commands are defined — not wired
// to any button yet.
async function printReceipt(order) {
  if (!printerPort) {
    alert("Connect a printer first.");
    return;
  }
  const writer = printerPort.writable.getWriter();
  const encoder = new TextEncoder();
  const lines = [
    `Rajeshwari Medical & General Stores\n`,
    `Order ${order.id.slice(0, 8)}\n`,
    `Customer: ${order.customerName}\n`,
    ...(order.items || []).map((i) => `${i.name} x${i.qty}  ₹${(i.qty * i.price).toFixed(2)}\n`),
    `Total: ₹${Number(order.total || 0).toFixed(2)}\n\n\n`,
  ];
  await writer.write(encoder.encode(lines.join("")));
  writer.releaseLock();
}
