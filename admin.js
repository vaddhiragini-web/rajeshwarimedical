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

const STORE_LOGIN_URL = "index.html";

let db = null;
let supabaseClient = null;
let firebaseFns = null;

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

const logoutBtn = document.getElementById("admin-logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.location.href = STORE_LOGIN_URL;
  });
}

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
      deleteDoc: firestoreMod.deleteDoc,
      writeBatch: firestoreMod.writeBatch,
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
      const isImageAttachment = o.attachment && o.attachment.type && o.attachment.type.startsWith("image/");
      const attachmentTag = o.attachment
        ? isImageAttachment
          ? `<a href="${o.attachment.url}" target="_blank" rel="noopener"><img src="${o.attachment.url}" alt="${escapeHtml(o.attachment.name)}" class="order-attachment-thumb" /></a>`
          : `<br/><a href="${o.attachment.url}" target="_blank" rel="noopener" class="attachment-link">📎 ${escapeHtml(o.attachment.name)}</a>`
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

function buildReceiptHTML(order) {
  const placed = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toLocaleString() : "—";
  const shortId = order.id.slice(0, 8).toUpperCase();
  const d = order.deliveryDetails || {};

  const itemRows = (order.items || []).length
    ? order.items
        .map((i) => {
          const batchLine = i.batchNumber || i.expiryDate
            ? `<br/><span style="font-size:11px;color:#555;">${i.batchNumber ? `Batch: ${escapeHtml(i.batchNumber)}` : ""}${i.batchNumber && i.expiryDate ? " · " : ""}${i.expiryDate ? `Exp: ${escapeHtml(formatExpiryShort(i.expiryDate))}` : ""}</span>`
            : "";
          return `<tr><td>${escapeHtml(i.name)}${batchLine}</td><td class="r">${i.qty}</td><td class="r">₹${Number(i.qty * i.price).toFixed(2)}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="3" style="font-style:italic;">No items listed — see attached file</td></tr>`;

  const attachmentLine = order.attachment
    ? `<p class="meta">📎 Attached: ${escapeHtml(order.attachment.name)}</p>`
    : "";

  const dlLine = currentDlNumber
    ? `<p class="center meta">DL No: ${escapeHtml(currentDlNumber)}</p>`
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
  ${dlLine}
  <p class="center meta">${escapeHtml(placed)}</p>
  <hr/>
  <p>Order ID: <strong>${shortId}</strong></p>
  <p class="meta">Flat: ${escapeHtml(d.flat || "-")} | ${escapeHtml(order.customerPhone || "-")}</p>
  ${d.altPhone ? `<p class="meta">Alt: ${escapeHtml(d.altPhone)}</p>` : ""}
  <p class="meta">${escapeHtml(d.street || "-")}, ${escapeHtml(d.landmark || "-")}</p>
  <p class="meta">${escapeHtml(d.mandal || "-")} / ${escapeHtml(d.district || "-")}</p>
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

function csvEscape(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ordersToCSV(orders) {
  const headers = [
    "Order ID",
    "Date",
    "Customer Name",
    "Phone",
    "Items",
    "Total",
    "Status",
    "Street",
    "Landmark",
    "Mandal",
    "District",
    "Flat/House No.",
    "Alt Phone",
    "Packing Note",
    "Attachment",
  ];

  const rows = orders.map((o) => {
    const when = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString() : "";
    const items = Array.isArray(o.items) && o.items.length
      ? o.items
          .map((i) => {
            const batchBit = i.batchNumber ? ` [Batch ${i.batchNumber}` : "";
            const expBit = i.expiryDate ? `${i.batchNumber ? ", " : " ["}Exp ${formatExpiryShort(i.expiryDate)}` : "";
            const suffix = batchBit || expBit ? `${batchBit}${expBit}]` : "";
            return `${i.name} x${i.qty} (₹${Number(i.qty * i.price).toFixed(2)})${suffix}`;
          })
          .join("; ")
      : o.attachment
      ? "No items — see attachment"
      : "";
    const d = o.deliveryDetails || {};
    return [
      o.id,
      when,
      o.customerName || "",
      o.customerPhone || "",
      items,
      Number(o.total || 0).toFixed(2),
      o.status || "pending",
      d.street || "",
      d.landmark || "",
      d.mandal || "",
      d.district || "",
      d.flat || "",
      d.altPhone || "",
      d.note || "",
      o.attachment ? o.attachment.url : "",
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function downloadOrdersCSV() {
  if (allOrders.length === 0) {
    alert("There are no orders to download yet.");
    return;
  }
  const csv = ordersToCSV(allOrders);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const downloadOrdersCsvBtn = document.getElementById("download-orders-csv-btn");
if (downloadOrdersCsvBtn) {
  downloadOrdersCsvBtn.addEventListener("click", downloadOrdersCSV);
}

const deleteAllOrdersBtn = document.getElementById("delete-all-orders-btn");
if (deleteAllOrdersBtn) {
  deleteAllOrdersBtn.addEventListener("click", deleteAllOrders);
}

async function deleteAllOrders() {
  if (!db || !firebaseFns) {
    alert("Orders aren't connected right now — try again in a moment.");
    return;
  }
  if (allOrders.length === 0) {
    alert("There are no orders to delete.");
    return;
  }

  const firstConfirm = confirm(
    `This will permanently delete all ${allOrders.length} order(s). This cannot be undone. Continue?`
  );
  if (!firstConfirm) return;

  const typed = prompt('Type DELETE to confirm permanently deleting all orders.');
  if (typed !== "DELETE") {
    alert("Delete cancelled — text didn't match.");
    return;
  }

  deleteAllOrdersBtn.disabled = true;
  deleteAllOrdersBtn.textContent = "Deleting…";

  try {
    const ids = allOrders.map((o) => o.id);
    const BATCH_LIMIT = 450; // stay under Firestore's 500-write batch cap
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_LIMIT);
      const batch = firebaseFns.writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(firebaseFns.doc(db, "orders", id));
      });
      await batch.commit();
    }
    alert("All orders deleted.");
  } catch (err) {
    alert("Couldn't delete all orders: " + err.message);
  } finally {
    deleteAllOrdersBtn.disabled = false;
    deleteAllOrdersBtn.textContent = "🗑 Delete All Orders";
  }
}

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
const pBatch = document.getElementById("p-batch");
const pExpiry = document.getElementById("p-expiry");
const pImage = document.getElementById("p-image");

const pImageFile = document.getElementById("p-image-file");
const pImagePreview = document.getElementById("p-image-preview");
const pImagePreviewName = document.getElementById("p-image-preview-name");
const pImageRemoveBtn = document.getElementById("p-image-remove-btn");
const pImageUploadStatus = document.getElementById("p-image-upload-status");
let selectedProductImageFile = null;

const PRODUCT_IMAGES_BUCKET = "product-images";

if (pImageFile) {
  pImageFile.addEventListener("change", () => {
    const file = pImageFile.files && pImageFile.files[0];
    if (!file) return;

    const MAX_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      productFormError.textContent = "That image is too large (max 8 MB). Please choose a smaller file.";
      productFormError.hidden = false;
      pImageFile.value = "";
      return;
    }

    selectedProductImageFile = file;
    pImagePreviewName.textContent = file.name;
    pImagePreview.hidden = false;
  });
}

if (pImageRemoveBtn) {
  pImageRemoveBtn.addEventListener("click", () => {
    selectedProductImageFile = null;
    pImageFile.value = "";
    pImagePreview.hidden = true;
  });
}

function resetProductImageUpload() {
  selectedProductImageFile = null;
  if (pImageFile) pImageFile.value = "";
  if (pImagePreview) pImagePreview.hidden = true;
  if (pImageUploadStatus) {
    pImageUploadStatus.hidden = true;
    pImageUploadStatus.textContent = "";
  }
}

async function uploadProductImage(file) {
  if (!supabaseClient) {
    throw new Error("Image storage isn't connected right now — try again in a moment.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Couldn't upload image: ${uploadError.message}`);
  }

  const { data: urlData } = supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

let allProducts = [];

async function loadProducts() {
  if (!productsTableBody) return;
  productsTableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">Loading products…</td></tr>`;
  const { data, error } = await supabaseClient.from("products").select("*").order("name", { ascending: true });
  if (error) {
    productsTableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">Couldn't load products: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  allProducts = data || [];
  renderProducts();
}

function formatExpiry(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpiredOrSoon(dateStr) {
  if (!dateStr) return { expired: false, soon: false };
  const expiry = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return { expired: expiry < now, soon: expiry >= now && expiry <= sixMonths };
}

function renderProducts() {
  if (!productsTableBody) return;
  if (allProducts.length === 0) {
    productsTableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">No products yet — add one above.</td></tr>`;
    return;
  }
  productsTableBody.innerHTML = allProducts
    .map((p) => {
      const { expired, soon } = isExpiredOrSoon(p.expiry_date);
      const expiryColor = expired ? "var(--red, #d32f2f)" : soon ? "var(--yellow, #ff9800)" : "inherit";
      return `
        <tr data-id="${p.id}">
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.category || "—")}</td>
          <td>${escapeHtml(p.batch_number || "—")}</td>
          <td style="color:${expiryColor};font-weight:${expired || soon ? "700" : "400"};">${formatExpiry(p.expiry_date)}${expired ? " ⚠️" : ""}</td>
          <td>₹${Number(p.price).toFixed(2)}</td>
          <td>${p.stock}</td>
          <td>
            <button type="button" class="btn btn-ghost edit-product-btn">Edit</button>
            <button type="button" class="btn btn-ghost delete-product-btn">Delete</button>
          </td>
        </tr>`;
    })
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
      pBatch.value = p.batch_number || "";
      pExpiry.value = p.expiry_date || "";
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
      batch_number: pBatch.value.trim(),
      expiry_date: pExpiry.value || null,
      image_url: pImage.value.trim() || null,
    };

    if (!payload.name || isNaN(payload.price) || isNaN(payload.stock)) {
      productFormError.textContent = "Please fill in name, price, and stock correctly.";
      productFormError.hidden = false;
      return;
    }

    if (!payload.batch_number) {
      productFormError.textContent = "Please enter a batch number.";
      productFormError.hidden = false;
      return;
    }

    if (!payload.expiry_date) {
      productFormError.textContent = "Please enter an expiry date.";
      productFormError.hidden = false;
      return;
    }

    productSubmitBtn.disabled = true;

    if (selectedProductImageFile) {
      try {
        pImageUploadStatus.hidden = false;
        pImageUploadStatus.textContent = "Uploading image…";
        payload.image_url = await uploadProductImage(selectedProductImageFile);
        pImageUploadStatus.textContent = "Image uploaded.";
      } catch (err) {
        productSubmitBtn.disabled = false;
        productFormError.textContent = err.message;
        productFormError.hidden = false;
        pImageUploadStatus.hidden = true;
        return;
      }
    }

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
  resetProductImageUpload();
}

const liveToggles = [
  { checkbox: document.getElementById("site-live-toggle"), dot: document.getElementById("live-dot"), text: document.getElementById("live-text") },
  { checkbox: document.getElementById("site-live-toggle-2"), dot: document.getElementById("live-dot-2"), text: document.getElementById("live-text-2") },
];

let currentDlNumber = "";

async function loadSiteLiveState() {
  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("is_live, dl_number")
    .eq("id", 1)
    .single();
  if (error) {
    console.error("store_settings load failed:", error.message);
    showBackendWarning('Site-live toggle needs a "store_settings" table (id, is_live, dl_number) in Supabase — see admin.js for the create-table snippet.');
    return;
  }
  applyLiveState(!!data.is_live);
  currentDlNumber = data.dl_number || "";
  applyDlNumber(currentDlNumber);
}

function applyDlNumber(value) {
  const currentEl = document.getElementById("dl-number-current");
  const inputEl = document.getElementById("dl-number-input");
  if (currentEl) currentEl.textContent = value || "Not set";
  if (inputEl && document.activeElement !== inputEl) inputEl.value = value || "";
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
    applyLiveState(isLive);
    const { error } = await supabaseClient.from("store_settings").upsert({ id: 1, is_live: isLive });
    if (error) {
      alert("Couldn't update site status: " + error.message);
      applyLiveState(!isLive);
    }
  });
});

const dlNumberSaveBtn = document.getElementById("dl-number-save-btn");
const dlNumberInput = document.getElementById("dl-number-input");
const dlNumberStatus = document.getElementById("dl-number-status");

if (dlNumberSaveBtn) {
  dlNumberSaveBtn.addEventListener("click", async () => {
    const value = dlNumberInput.value.trim();
    dlNumberSaveBtn.disabled = true;
    const { error } = await supabaseClient.from("store_settings").upsert({ id: 1, dl_number: value });
    dlNumberSaveBtn.disabled = false;

    if (dlNumberStatus) {
      dlNumberStatus.hidden = false;
      if (error) {
        dlNumberStatus.textContent = "Couldn't save DL number: " + error.message;
      } else {
        currentDlNumber = value;
        applyDlNumber(value);
        dlNumberStatus.textContent = "Saved.";
        setTimeout(() => {
          dlNumberStatus.hidden = true;
        }, 2500);
      }
    }
  });
}

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
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      });
      alert(`Connected to ${device.name || "printer"}. Wire up the actual print commands for your printer model.`);
    } catch (err) {
      console.log("Printer pairing cancelled/failed:", err.message);
    }
  });
}

function formatExpiryShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { month: "2-digit", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
