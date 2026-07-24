// ============================================================================
// ADMIN CONSOLE — admin.js
// Reuses the same Firebase (orders) + Supabase (products) project as the
// customer-facing store. This file is the missing piece: admin.html was only
// loading store.js, which targets the *customer* page's element IDs
// (#login-screen, #shop-screen, #product-grid, ...). None of those exist on
// admin.html, so the very first line of store.js threw a TypeError and the
// whole script died silently — nothing on this page ever got wired up.
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

// Where "Logout" sends staff back to. Adjust if your customer page has a
// different filename.
const STORE_LOGIN_URL = "index.html";

// NOTE ON THE "SITE LIVE" TOGGLE
// ----------------------------------------------------------------------------
// For the toggle to actually broadcast to every customer instantly, it needs
// to live somewhere shared (a database row), not localStorage. This script
// reads/writes a single row in a Supabase table called `store_settings`:
//   create table store_settings (
//     id int primary key default 1,
//     is_live boolean not null default true
//   );
//   insert into store_settings (id, is_live) values (1, true);
// If that table doesn't exist yet, the toggle will show a warning instead of
// silently failing, and you can create the table above to enable it.
// ----------------------------------------------------------------------------

let db = null;
let supabaseClient = null;
let firebaseFns = null; // { collection, doc, onSnapshot, query, orderBy, updateDoc }

const backendWarningEl = document.getElementById("admin-backend-warning");
function showBackendWarning(msg) {
  if (!backendWarningEl) return;
  backendWarningEl.textContent = msg;
  backendWarningEl.hidden = false;
}
function clearBackendWarning() {
  if (!backendWarningEl) return;
  backendWarningEl.hidden = true;
}

// ============================================================================
// Tabs
// ============================================================================
const tabButtons = document.querySelectorAll(".admin-tab");
const panels = {
  stats: document.getElementById("panel-stats"),
  orders: document.getElementById("panel-orders"),
  products: document.getElementById("panel-products"),
  settings: document.getElementById("panel-settings"),
};

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    Object.entries(panels).forEach(([name, el]) => {
      if (el) el.hidden = name !== target;
    });
  });
});

// ============================================================================
// Logout
// ============================================================================
const logoutBtn = document.getElementById("admin-logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.location.href = STORE_LOGIN_URL;
  });
}

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
    const app = initializeApp(firebaseConfig);
    db = firestoreMod.getFirestore(app);
    firebaseFns = {
      collection: firestoreMod.collection,
      doc: firestoreMod.doc,
      onSnapshot: firestoreMod.onSnapshot,
      query: firestoreMod.query,
      orderBy: firestoreMod.orderBy,
      updateDoc: firestoreMod.updateDoc,
    };
  } catch (err) {
    console.error("Firebase init failed:", err);
    db = null;
    firebaseFns = null;
  }

  if (!supabaseClient && !db) {
    showBackendWarning("Couldn't connect to the backend — orders and products won't load. Try refreshing.");
  } else if (!supabaseClient) {
    showBackendWarning("Product catalog is temporarily unavailable.");
  } else if (!db) {
    showBackendWarning("Orders are temporarily unavailable — you can still manage products.");
  } else {
    clearBackendWarning();
  }

  if (db && firebaseFns) subscribeOrders();
  if (supabaseClient) {
    loadProducts();
    loadSiteLiveState();
  }
}
initBackend();

// ============================================================================
// ORDERS (Firestore, live)
// ============================================================================
const ordersTableBody = document.getElementById("orders-table-body");
const ordersCountTitle = document.getElementById("orders-count-title");
let allOrders = [];
let ordersUnsubscribe = null;

function subscribeOrders() {
  if (ordersUnsubscribe) ordersUnsubscribe();
  const q = firebaseFns.query(
    firebaseFns.collection(db, "orders"),
    firebaseFns.orderBy("createdAt", "desc")
  );
  ordersUnsubscribe = firebaseFns.onSnapshot(
    q,
    (snapshot) => {
      allOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderOrders();
      renderStats();
    },
    (err) => {
      if (ordersTableBody) {
        ordersTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Couldn't load orders: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  );
}

const STATUS_OPTIONS = ["pending", "accepted", "fulfilled", "cancelled"];

function renderOrders() {
  if (!ordersTableBody) return;

  if (ordersCountTitle) {
    ordersCountTitle.textContent = `All recent orders (${allOrders.length} total)`;
  }

  if (allOrders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">No orders yet.</td></tr>`;
    return;
  }

  ordersTableBody.innerHTML = allOrders
    .map((o) => {
      const when = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString() : "Just now";
      const attachmentTag = o.attachment
        ? `<br/><a href="${o.attachment.url}" target="_blank" rel="noopener" class="attachment-link">📎 ${escapeHtml(o.attachment.name)}</a>`
        : "";
      const itemsSummary =
        Array.isArray(o.items) && o.items.length
          ? o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")
          : o.attachment
          ? "No items — see attachment"
          : "—";
      const status = o.status || "pending";
      const options = STATUS_OPTIONS.map(
        (s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`
      ).join("");
      return `
        <tr data-id="${o.id}">
          <td>${o.id.slice(0, 8)}</td>
          <td>${when}</td>
          <td>${escapeHtml(o.customerName || "—")}</td>
          <td>${escapeHtml(o.customerPhone || "—")}</td>
          <td>${escapeHtml(itemsSummary)}${attachmentTag}</td>
          <td>₹${Number(o.total || 0).toFixed(2)}</td>
          <td><span class="status-pill ${status}">${status}</span></td>
          <td>
            <select class="status-select text-field">${options}</select>
            <button type="button" class="btn btn-ghost print-order-btn">🖶 Print</button>
          </td>
        </tr>`;
    })
    .join("");

  ordersTableBody.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const row = e.target.closest("tr");
      const orderId = row.dataset.id;
      try {
        await firebaseFns.updateDoc(firebaseFns.doc(db, "orders", orderId), {
          status: e.target.value,
        });
      } catch (err) {
        alert("Couldn't update order status: " + err.message);
      }
    });
  });

  ordersTableBody.querySelectorAll(".print-order-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const order = allOrders.find((o) => o.id === row.dataset.id);
      if (order) printOrderReceipt(order);
    });
  });
}

// ============================================================================
// Printable receipt for a single order — same layout customers see after
// checkout, so admin can reprint a copy at the counter/for delivery.
// ============================================================================
function buildReceiptHTML(order) {
  const placed = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toLocaleString() : "—";
  const shortId = order.id.slice(0, 8).toUpperCase();
  const d = order.deliveryDetails || {};

  const itemRows = (order.items || []).length
    ? order.items
        .map(
          (i) =>
            `<tr><td>${escapeHtml(i.name)}</td><td class="r">${i.qty}</td><td class="r">₹${Number(i.qty * i.price).toFixed(2)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="font-style:italic;">No items listed — see attached file</td></tr>`;

  const attachmentLine = order.attachment
    ? `<p class="meta">📎 Attached: ${escapeHtml(order.attachment.name)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Receipt ${shortId}</title>
<style>
  body { font-family: 'Courier New', monospace; width: 300px; margin: 20px auto; color: #111; font-size: 13px; }
  .center { text-align: center; }
  .logo { font-size: 28px; }
  h2 { margin: 4px 0; font-size: 16px; }
  .meta { color: #444; margin: 2px 0; }
  hr { border: none; border-top: 1px dashed #333; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  td.r { text-align: right; }
  .total-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 6px; }
  .thanks { margin-top: 14px; }
</style>
</head>
<body>
  <p class="center logo">℞</p>
  <h2 class="center">RAJESHWARI MEDICAL</h2>
  <p class="center meta">&amp; General Stores</p>
  <p class="center meta">${escapeHtml(placed)}</p>
  <hr/>
  <p>Order ID: <strong>${shortId}</strong></p>
  <p class="meta">Flat: ${escapeHtml(d.flat || "-")} | ${escapeHtml(order.customerPhone || "-")}</p>
  ${d.altPhone ? `<p class="meta">Alt: ${escapeHtml(d.altPhone)}</p>` : ""}
  <p class="meta">${escapeHtml(d.community || "-")} / ${escapeHtml(d.block || "-")}</p>
  ${d.note ? `<p class="meta">Note: ${escapeHtml(d.note)}</p>` : ""}
  ${attachmentLine}
  <hr/>
  <table>${itemRows}</table>
  <hr/>
  <div class="total-line"><span>TOTAL</span><span>₹${Number(order.total || 0).toFixed(2)}</span></div>
  <p class="center thanks">Thank you! Visit again</p>
</body>
</html>`;
}

function printOrderReceipt(order) {
  const printWindow = window.open("", "_blank", "width=380,height=640");
  if (!printWindow) {
    alert("Please allow pop-ups for this site to print the receipt.");
    return;
  }
  printWindow.document.write(buildReceiptHTML(order));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

// ============================================================================
// STATS
// ============================================================================
function renderStats() {
  const total = allOrders.length;
  const pending = allOrders.filter((o) => (o.status || "pending") === "pending").length;
  const fulfilled = allOrders.filter((o) => o.status === "fulfilled" || o.status === "delivered").length;
  const revenue = allOrders
    .filter((o) => o.status === "fulfilled" || o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  setText("stat-total-orders", total);
  setText("stat-pending-orders", pending);
  setText("stat-fulfilled-orders", fulfilled);
  setText("stat-total-revenue", `₹${revenue.toFixed(2)}`);
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================================
// PRODUCTS (Supabase CRUD)
// ============================================================================
const productsTableBody = document.getElementById("products-table-body");
const productForm = document.getElementById("product-form");
const productSubmitBtn = document.getElementById("product-submit-btn");
const productCancelBtn = document.getElementById("product-cancel-btn");
const productFormError = document.getElementById("product-form-error");

const pIdField = document.getElementById("p-id");
const pName = document.getElementById("p-name");
const pCategory = document.getElementById("p-category");
const pPrice = document.getElementById("p-price");
const pStock = document.getElementById("p-stock");
const pImage = document.getElementById("p-image");

let allProducts = [];

async function loadProducts() {
  if (!productsTableBody) return;
  productsTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">Loading products…</td></tr>`;
  const { data, error } = await supabaseClient.from("products").select("*").order("name", { ascending: true });
  if (error) {
    productsTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">Couldn't load products: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  allProducts = data || [];
  renderProducts();
}

function renderProducts() {
  if (!productsTableBody) return;
  if (allProducts.length === 0) {
    productsTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">No products yet — add one above.</td></tr>`;
    return;
  }
  productsTableBody.innerHTML = allProducts
    .map(
      (p) => `
        <tr data-id="${p.id}">
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.category || "—")}</td>
          <td>₹${Number(p.price).toFixed(2)}</td>
          <td>${p.stock}</td>
          <td>
            <button type="button" class="btn btn-ghost edit-product-btn">Edit</button>
            <button type="button" class="btn btn-ghost delete-product-btn">Delete</button>
          </td>
        </tr>`
    )
    .join("");

  productsTableBody.querySelectorAll(".edit-product-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("tr").dataset.id;
      const p = allProducts.find((x) => String(x.id) === String(id));
      if (!p) return;
      pIdField.value = p.id;
      pName.value = p.name || "";
      pCategory.value = p.category || "";
      pPrice.value = p.price ?? "";
      pStock.value = p.stock ?? "";
      pImage.value = p.image_url || "";
      productSubmitBtn.textContent = "Save Changes";
      productCancelBtn.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  productsTableBody.querySelectorAll(".delete-product-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("tr").dataset.id;
      if (!confirm("Delete this product?")) return;
      const { error } = await supabaseClient.from("products").delete().eq("id", id);
      if (error) {
        alert("Couldn't delete product: " + error.message);
        return;
      }
      loadProducts();
    });
  });
}

if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    productFormError.hidden = true;

    const payload = {
      name: pName.value.trim(),
      category: pCategory.value.trim(),
      price: Number(pPrice.value),
      stock: Number(pStock.value),
      image_url: pImage.value.trim() || null,
    };

    if (!payload.name || isNaN(payload.price) || isNaN(payload.stock)) {
      productFormError.textContent = "Please fill in name, price, and stock correctly.";
      productFormError.hidden = false;
      return;
    }

    productSubmitBtn.disabled = true;
    const editingId = pIdField.value;

    const { error } = editingId
      ? await supabaseClient.from("products").update(payload).eq("id", editingId)
      : await supabaseClient.from("products").insert(payload);

    productSubmitBtn.disabled = false;

    if (error) {
      productFormError.textContent = "Couldn't save product: " + error.message;
      productFormError.hidden = false;
      return;
    }

    resetProductForm();
    loadProducts();
  });
}

if (productCancelBtn) {
  productCancelBtn.addEventListener("click", resetProductForm);
}

function resetProductForm() {
  productForm.reset();
  pIdField.value = "";
  productSubmitBtn.textContent = "Add Product";
  productCancelBtn.hidden = true;
  productFormError.hidden = true;
}

// ============================================================================
// SITE LIVE toggle (Supabase `store_settings` table, row id=1)
// See the NOTE at the top of this file if this table doesn't exist yet.
// ============================================================================
const liveToggles = [
  { checkbox: document.getElementById("site-live-toggle"), dot: document.getElementById("live-dot"), text: document.getElementById("live-text") },
  { checkbox: document.getElementById("site-live-toggle-2"), dot: document.getElementById("live-dot-2"), text: document.getElementById("live-text-2") },
];

async function loadSiteLiveState() {
  const { data, error } = await supabaseClient.from("store_settings").select("is_live").eq("id", 1).single();
  if (error) {
    console.error("store_settings load failed:", error.message);
    showBackendWarning('Site-live toggle needs a "store_settings" table (id, is_live) in Supabase — see admin.js for the create-table snippet.');
    return;
  }
  applyLiveState(!!data.is_live);
}

function applyLiveState(isLive) {
  liveToggles.forEach(({ checkbox, dot, text }) => {
    if (checkbox) checkbox.checked = isLive;
    if (dot) dot.style.background = isLive ? "#27c94b" : "#ccc";
    if (text) text.textContent = isLive ? "Site LIVE" : "Site OFFLINE";
  });
}

liveToggles.forEach(({ checkbox }) => {
  if (!checkbox) return;
  checkbox.addEventListener("change", async (e) => {
    const isLive = e.target.checked;
    applyLiveState(isLive); // optimistic UI
    const { error } = await supabaseClient.from("store_settings").upsert({ id: 1, is_live: isLive });
    if (error) {
      alert("Couldn't update site status: " + error.message);
      applyLiveState(!isLive); // revert
    }
  });
});

// ============================================================================
// Connect Printer (stub — wire up to your actual thermal printer SDK)
// Most receipt printers on Android/Windows use either Web Bluetooth or
// WebUSB. This is a minimal Web Bluetooth pairing prompt as a starting
// point; replace the print logic with your printer's actual command set.
// ============================================================================
const connectPrinterBtn = document.getElementById("connect-printer-btn");
if (connectPrinterBtn) {
  connectPrinterBtn.addEventListener("click", async () => {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth isn't supported in this browser. Try Chrome on Android/desktop.");
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"], // common thermal-printer service UUID
      });
      alert(`Connected to ${device.name || "printer"}. Wire up the actual print commands for your printer model.`);
    } catch (err) {
      // User cancelled the picker, or no device found — not a real error.
      console.log("Printer pairing cancelled/failed:", err.message);
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
