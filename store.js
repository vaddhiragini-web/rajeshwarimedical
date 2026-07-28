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

const ADMIN_CONSOLE_URL = "admin.html";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=400&auto=format&fit=crop";


const SESSION_KEY = "rmg_customer_session";
const CART_KEY = "rmg_cart";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}
function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "{}");
  } catch {
    return {};
  }
}
function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

const loginScreen = document.getElementById("login-screen");
const adminLoginScreen = document.getElementById("admin-login-screen");
const shopScreen = document.getElementById("shop-screen");

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const adminLoginLink = document.getElementById("admin-login-link");

const adminLoginForm = document.getElementById("admin-login-form");
const adminLoginError = document.getElementById("admin-login-error");
const backToCustomerLink = document.getElementById("back-to-customer-link");

const backendWarning = document.getElementById("backend-warning");

const userChip = document.getElementById("user-chip");
const logoutBtn = document.getElementById("logout-btn");

const searchInput = document.getElementById("search-input");
const itemCountPill = document.getElementById("item-count-pill");
const productGrid = document.getElementById("product-grid");

const cartCountEl = document.getElementById("cart-count");
const openCartBtn = document.getElementById("open-cart-btn");
const closeCartBtn = document.getElementById("close-cart-btn");
const cartBackdrop = document.getElementById("cart-backdrop");
const cartDrawer = document.getElementById("cart-drawer");
const cartBody = document.getElementById("cart-body");
const cartTotalEl = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");

const cartView = document.getElementById("cart-view");
const checkoutView = document.getElementById("checkout-view");
const confirmationView = document.getElementById("confirmation-view");
const cartDrawerTitle = document.getElementById("cart-drawer-title");

const deliveryForm = document.getElementById("delivery-form");
const dStreet = document.getElementById("d-street");
const dLandmark = document.getElementById("d-landmark");
const dMandal = document.getElementById("d-mandal");
const dDistrict = document.getElementById("d-district");
const dFlat = document.getElementById("d-flat");
const dAltPhone = document.getElementById("d-alt-phone");
const dNote = document.getElementById("d-note");
const deliveryError = document.getElementById("delivery-error");

const dFile = document.getElementById("d-file");
const filePreview = document.getElementById("file-preview");
const filePreviewName = document.getElementById("file-preview-name");
const removeFileBtn = document.getElementById("remove-file-btn");
const fileUploadStatus = document.getElementById("file-upload-status");
let selectedFile = null;

const checkoutSummaryLines = document.getElementById("checkout-summary-lines");
const checkoutTotalEl = document.getElementById("checkout-total");
const backToCartBtn = document.getElementById("back-to-cart-btn");
const placeOrderBtn = document.getElementById("place-order-btn");

const confirmOrderIdEl = document.getElementById("confirm-order-id");
const printReceiptBtn = document.getElementById("print-receipt-btn");
const whatsappShareBtn = document.getElementById("whatsapp-share-btn");
const confirmContinueBtn = document.getElementById("confirm-continue-btn");
const callUsLink = document.getElementById("call-us-link");
const confirmCallBtn = document.getElementById("confirm-call-btn");
const confirmCallNote = document.getElementById("confirm-call-note");

let lastPlacedOrder = null;

const navOrdersBtn = document.getElementById("nav-orders");
const closeOrdersBtn = document.getElementById("close-orders-btn");
const ordersBackdrop = document.getElementById("orders-backdrop");
const ordersDrawer = document.getElementById("orders-drawer");
const ordersBody = document.getElementById("orders-body");

let allProducts = [];
let currentDlNumber = "";
let currentContactPhone = "";
let whatsappShareEnabled = false;

async function loadStoreSettings() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("dl_number, contact_phone, whatsapp_share_enabled")
    .eq("id", 1)
    .single();
  if (!error && data) {
    currentDlNumber = data.dl_number || "";
    currentContactPhone = data.contact_phone || "";
    whatsappShareEnabled = !!data.whatsapp_share_enabled;
    applyContactPhoneToUI();
    applyWhatsappShareToUI();
  }
}

function applyContactPhoneToUI() {
  const digits = String(currentContactPhone || "").replace(/\D/g, "");
  [callUsLink, confirmCallBtn].forEach((el) => {
    if (!el) return;
    if (digits) {
      el.href = `tel:+91${digits.length > 10 ? digits.slice(-10) : digits}`;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });
  if (confirmCallNote) confirmCallNote.hidden = !digits;
}

function applyWhatsappShareToUI() {
  if (whatsappShareBtn) whatsappShareBtn.hidden = !whatsappShareEnabled;
}

let db = null;
let supabaseClient = null;
let firebaseFns = null;

function showBackendWarning(message) {
  if (!backendWarning) return;
  backendWarning.textContent = message;
  backendWarning.hidden = false;
}

function showScreen(name) {
  loginScreen.hidden = name !== "login";
  adminLoginScreen.hidden = name !== "admin-login";
  shopScreen.hidden = name !== "shop";
}

adminLoginLink.addEventListener("click", () => {
  adminLoginError.hidden = true;
  adminLoginForm.reset();
  showScreen("admin-login");
});

backToCustomerLink.addEventListener("click", () => {
  loginError.hidden = true;
  showScreen("login");
});

const existingSession = getSession();
if (existingSession) {
  enterShop(existingSession);
} else {
  showScreen("login");
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const name = document.getElementById("c-name").value.trim();
  const phoneDigits = document.getElementById("c-phone").value.trim();

  if (!name) {
    loginError.textContent = "Please enter your name.";
    loginError.hidden = false;
    return;
  }

  if (!/^[0-9]{10}$/.test(phoneDigits)) {
    loginError.textContent = "Enter a valid 10-digit mobile number.";
    loginError.hidden = false;
    return;
  }

  const session = { name, phone: `+91${phoneDigits}` };
  setSession(session);
  enterShop(session);
});

function enterShop(session) {
  showScreen("shop");
  userChip.textContent = session.name || session.phone;
  renderCartFromStorage();
  loadProducts();
  loadStoreSettings();
}

logoutBtn.addEventListener("click", () => {
  clearSession();
  loginForm.reset();
  showScreen("login");
});

adminLoginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  adminLoginError.hidden = true;

  const username = document.getElementById("a-username").value.trim();
  const password = document.getElementById("a-password").value;

  if (!username || !password) {
    adminLoginError.textContent = "Enter both username and password.";
    adminLoginError.hidden = false;
    return;
  }

  window.location.href = ADMIN_CONSOLE_URL;
});

async function initBackend() {

  try {
    if (!window.supabase) {
      throw new Error("Supabase library did not load.");
    }
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
      addDoc: firestoreMod.addDoc,
      onSnapshot: firestoreMod.onSnapshot,
      query: firestoreMod.query,
      where: firestoreMod.where,
      orderBy: firestoreMod.orderBy,
      serverTimestamp: firestoreMod.serverTimestamp,
    };
  } catch (err) {
    console.error("Firebase init failed:", err);
    db = null;
    firebaseFns = null;
  }

  if (!supabaseClient) {
    showBackendWarning("Product catalog is temporarily unavailable — please refresh in a moment.");
  } else if (!db) {
    showBackendWarning("Orders are temporarily unavailable — you can still browse products.");
  }


  if (supabaseClient && !shopScreen.hidden) {
    loadProducts();
    loadStoreSettings();
  }
}

initBackend();

async function loadProducts() {
  if (!supabaseClient) {
    productGrid.innerHTML = `<p class="empty-state">Products will appear here once the store connects — try refreshing shortly.</p>`;
    itemCountPill.textContent = "0 items";
    return;
  }

  productGrid.innerHTML = `<p class="loading-state">Loading products…</p>`;
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    productGrid.innerHTML = `<p class="empty-state">Couldn't load products: ${escapeHtml(error.message)}</p>`;
    return;
  }
  allProducts = data || [];
  renderGrid(allProducts);
}

searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = term
    ? allProducts.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(term) ||
          (p.category || "").toLowerCase().includes(term)
      )
    : allProducts;
  renderGrid(filtered);
});

function renderGrid(products) {
  itemCountPill.textContent = `${products.length} item${products.length === 1 ? "" : "s"}`;

  if (products.length === 0) {
    productGrid.innerHTML = `<p class="empty-state">No products match your search.</p>`;
    return;
  }

  const cart = getCart();

  productGrid.innerHTML = products
    .map((p) => {
      const qty = cart[p.id]?.qty || 0;
      const outOfStock = Number(p.stock) <= 0;
      const img = p.image_url || FALLBACK_IMAGE;
      return `
        <div class="product-card" data-id="${p.id}">
          <div class="product-media">
            <img src="${img}" alt="${escapeHtml(p.name)}" loading="lazy" />
            <span class="price-badge">₹${Number(p.price).toFixed(0)} / unit</span>
          </div>
          <div class="product-body">
            ${p.category ? `<p class="product-cat">${escapeHtml(p.category)}</p>` : ""}
            <h3>${escapeHtml(p.name)}</h3>
            <p class="product-unit">${outOfStock ? "Out of stock" : `${p.stock} in stock`}</p>
            <div class="qty-slot">
              ${
                qty > 0
                  ? `<div class="stepper">
                       <button type="button" class="dec-btn">−</button>
                       <span>${qty}</span>
                       <button type="button" class="inc-btn" ${qty >= p.stock ? "disabled" : ""}>+</button>
                     </div>`
                  : `<button type="button" class="add-btn" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Unavailable" : "Add to Cart"}</button>`
              }
            </div>
          </div>
        </div>`;
    })
    .join("");

  productGrid.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".product-card").dataset.id;
      changeQty(id, 1);
    });
  });
  productGrid.querySelectorAll(".inc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".product-card").dataset.id;
      changeQty(id, 1);
    });
  });
  productGrid.querySelectorAll(".dec-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".product-card").dataset.id;
      changeQty(id, -1);
    });
  });
}

function changeQty(productId, delta) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const current = cart[productId]?.qty || 0;
  const next = Math.max(0, Math.min(product.stock, current + delta));

  if (next === 0) {
    delete cart[productId];
  } else {
    cart[productId] = {
      qty: next,
      name: product.name,
      price: product.price,
      image_url: product.image_url || FALLBACK_IMAGE,
      batch_number: product.batch_number || "",
      expiry_date: product.expiry_date || "",
    };
  }
  setCart(cart);
  renderGrid(searchInput.value.trim() ? filteredByCurrentSearch() : allProducts);
  renderCartFromStorage();
}

function filteredByCurrentSearch() {
  const term = searchInput.value.trim().toLowerCase();
  return allProducts.filter(
    (p) => (p.name || "").toLowerCase().includes(term) || (p.category || "").toLowerCase().includes(term)
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderCartFromStorage() {
  const cart = getCart();
  const entries = Object.entries(cart);
  const totalQty = entries.reduce((sum, [, item]) => sum + item.qty, 0);
  const totalPrice = entries.reduce((sum, [, item]) => sum + item.qty * item.price, 0);

  cartCountEl.textContent = totalQty;
  cartTotalEl.textContent = `₹${totalPrice.toFixed(2)}`;


  if (entries.length === 0) {
    cartBody.innerHTML = `<p class="loading-state">Your cart is empty.</p>`;
    return;
  }

  cartBody.innerHTML = entries
    .map(
      ([id, item]) => `
        <div class="cart-line" data-id="${id}">
          <img src="${item.image_url}" alt="${escapeHtml(item.name)}" />
          <div class="cart-line-info">
            <h4>${escapeHtml(item.name)}</h4>
            <span>₹${Number(item.price).toFixed(2)} each</span><br/>
            <button type="button" class="remove-btn">Remove</button>
          </div>
          <div class="stepper">
            <button type="button" class="dec-btn">−</button>
            <span>${item.qty}</span>
            <button type="button" class="inc-btn">+</button>
          </div>
        </div>`
    )
    .join("");

  cartBody.querySelectorAll(".inc-btn").forEach((btn) => {
    btn.addEventListener("click", () => changeQty(btn.closest(".cart-line").dataset.id, 1));
  });
  cartBody.querySelectorAll(".dec-btn").forEach((btn) => {
    btn.addEventListener("click", () => changeQty(btn.closest(".cart-line").dataset.id, -1));
  });
  cartBody.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cart = getCart();
      delete cart[btn.closest(".cart-line").dataset.id];
      setCart(cart);
      renderCartFromStorage();
      renderGrid(searchInput.value.trim() ? filteredByCurrentSearch() : allProducts);
    });
  });
}

openCartBtn.addEventListener("click", () => {
  showCartStep("cart");
  toggleDrawer(cartDrawer, cartBackdrop, true);
});
closeCartBtn.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, false));
cartBackdrop.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, false));

function toggleDrawer(drawer, backdrop, show) {
  drawer.hidden = !show;
  backdrop.hidden = !show;
}

function showCartStep(step) {
  cartView.hidden = step !== "cart";
  checkoutView.hidden = step !== "checkout";
  confirmationView.hidden = step !== "confirmation";
  cartDrawerTitle.textContent =
    step === "checkout" ? "Checkout" : step === "confirmation" ? "Order Placed" : "Your Cart";
}

checkoutBtn.addEventListener("click", () => {
  const cart = getCart();
  const entries = Object.entries(cart);


  const total = entries.reduce((sum, [, item]) => sum + item.qty * item.price, 0);
  checkoutSummaryLines.innerHTML =
    entries.length > 0
      ? entries
          .map(([, item]) => `<div><span>${escapeHtml(item.name)} x ${item.qty}</span><span>₹${(item.qty * item.price).toFixed(2)}</span></div>`)
          .join("")
      : `<div><span>No items selected — pharmacist will confirm items from your uploaded file.</span></div>`;
  checkoutTotalEl.textContent = `₹${total.toFixed(2)}`;

  showCartStep("checkout");
});

const ATTACHMENTS_BUCKET = "order-attachments";

async function uploadAttachment(file, phone) {
  if (!supabaseClient) {
    throw new Error("File storage isn't connected right now — try again in a moment, or place the order without the attachment.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${phone}_${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Couldn't upload file: ${uploadError.message}`);
  }

  const { data: urlData } = supabaseClient.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);

  return {
    name: file.name,
    url: urlData.publicUrl,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

async function deductStock(items) {
  if (!supabaseClient || !items || items.length === 0) return;

  await Promise.all(
    items.map(async (item) => {
      try {
        // Re-fetch the current stock right before writing, so we deduct from
        // the latest value rather than whatever was cached on the page.
        const { data, error: fetchError } = await supabaseClient
          .from("products")
          .select("stock")
          .eq("id", item.productId)
          .single();

        if (fetchError || !data) {
          console.error(`Couldn't read stock for product ${item.productId}:`, fetchError?.message);
          return;
        }

        const newStock = Math.max(0, Number(data.stock) - Number(item.qty));
        const { error: updateError } = await supabaseClient
          .from("products")
          .update({ stock: newStock })
          .eq("id", item.productId);

        if (updateError) {
          console.error(`Couldn't update stock for product ${item.productId}:`, updateError.message);
        }
      } catch (err) {
        console.error(`Stock deduction failed for product ${item.productId}:`, err.message);
      }
    })
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

dFile.addEventListener("change", () => {
  const file = dFile.files && dFile.files[0];
  if (!file) return;

  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    deliveryError.textContent = "That file is too large (max 15 MB). Please choose a smaller file.";
    deliveryError.hidden = false;
    dFile.value = "";
    return;
  }

  selectedFile = file;
  filePreviewName.textContent = `${file.name} (${formatFileSize(file.size)})`;
  filePreview.hidden = false;
});

removeFileBtn.addEventListener("click", () => {
  selectedFile = null;
  dFile.value = "";
  filePreview.hidden = true;
});

function resetFileUpload() {
  selectedFile = null;
  dFile.value = "";
  filePreview.hidden = true;
  fileUploadStatus.hidden = true;
  fileUploadStatus.textContent = "";
}

backToCartBtn.addEventListener("click", () => showCartStep("cart"));

placeOrderBtn.addEventListener("click", async () => {
  deliveryError.hidden = true;

  const session = getSession();
  const cart = getCart();
  const entries = Object.entries(cart);
  if (!session) return;

  const street = dStreet.value.trim();
  const landmark = dLandmark.value.trim();
  const mandal = dMandal.value.trim();
  const district = dDistrict.value.trim();
  const flat = dFlat.value.trim();
  const altPhoneDigits = dAltPhone.value.trim();
  const note = dNote.value.trim();

  if (!street || !landmark || !mandal || !district || !flat) {
    deliveryError.textContent = "Please fill in your street, landmark, mandal, district, and flat/house number.";
    deliveryError.hidden = false;
    return;
  }
  if (altPhoneDigits && !/^[0-9]{10}$/.test(altPhoneDigits)) {
    deliveryError.textContent = "Alt mobile must be a valid 10-digit number, or left blank.";
    deliveryError.hidden = false;
    return;
  }
  if (entries.length === 0 && !selectedFile) {
    deliveryError.textContent = "Add at least one item to your cart, or upload a file, to place an order.";
    deliveryError.hidden = false;
    return;
  }

  if (!db || !firebaseFns) {
    deliveryError.textContent = "Orders aren't connected yet — please try again in a moment.";
    deliveryError.hidden = false;
    return;
  }

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = "Placing order…";

  const items = entries.map(([id, item]) => ({
    productId: id,
    name: item.name,
    qty: item.qty,
    price: item.price,
    batchNumber: item.batch_number || "",
    expiryDate: item.expiry_date || "",
  }));
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  const deliveryDetails = {
    street,
    landmark,
    mandal,
    district,
    flat,
    altPhone: altPhoneDigits ? `+91${altPhoneDigits}` : "",
    note,
  };

  try {

    let attachment = null;
    if (selectedFile) {
      fileUploadStatus.hidden = false;
      fileUploadStatus.textContent = "Uploading file…";
      attachment = await uploadAttachment(selectedFile, session.phone);
      fileUploadStatus.textContent = "File uploaded.";
    }

    const docRef = await firebaseFns.addDoc(firebaseFns.collection(db, "orders"), {
      customerName: session.name,
      customerPhone: session.phone,
      items,
      total,
      deliveryDetails,
      attachment,
      status: "pending",
      createdAt: firebaseFns.serverTimestamp(),
    });

    lastPlacedOrder = {
      id: docRef.id,
      customerName: session.name,
      customerPhone: session.phone,
      items,
      total,
      deliveryDetails,
      attachment,
      placedAt: new Date(),
    };

    await deductStock(items);

    setCart({});
    renderCartFromStorage();
    await loadProducts();
    deliveryForm.reset();
    resetFileUpload();

    confirmOrderIdEl.textContent = docRef.id.slice(0, 8).toUpperCase();
    showCartStep("confirmation");
  } catch (err) {
    deliveryError.textContent = "Couldn't place order: " + err.message;
    deliveryError.hidden = false;
    fileUploadStatus.hidden = true;
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = "Place Order";
  }
});

confirmContinueBtn.addEventListener("click", () => {
  toggleDrawer(cartDrawer, cartBackdrop, false);
  showCartStep("cart");
});

printReceiptBtn.addEventListener("click", () => {
  if (!lastPlacedOrder) return;
  printReceipt(lastPlacedOrder);
});

if (whatsappShareBtn) {
  whatsappShareBtn.addEventListener("click", () => {
    if (!lastPlacedOrder) return;
    shareViaWhatsApp(lastPlacedOrder);
  });
}

function buildWhatsAppBillText(order) {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const d = order.deliveryDetails || {};

  const lines = [];
  lines.push("🧾 *Rajeshwari Medical & General Stores*");
  if (currentDlNumber) lines.push(`DL No: ${currentDlNumber}`);
  lines.push("");
  lines.push(`Order ID: *${shortId}*`);
  lines.push(`Name: ${order.customerName || "-"}`);
  lines.push("");

  if (Array.isArray(order.items) && order.items.length) {
    lines.push("*Items:*");
    order.items.forEach((i) => {
      const batchBit = i.batchNumber ? ` (Batch ${i.batchNumber}${i.expiryDate ? `, Exp ${formatExpiryShort(i.expiryDate)}` : ""})` : "";
      lines.push(`• ${i.name} x${i.qty} — ₹${Number(i.qty * i.price).toFixed(2)}${batchBit}`);
    });
    lines.push("");
  } else if (order.attachment) {
    lines.push("Order placed via attached file (no listed items).");
    lines.push("");
  }

  lines.push(`*Total: ₹${Number(order.total || 0).toFixed(2)}*`);
  lines.push("");
  lines.push("*Delivery to:*");
  lines.push(`${d.flat || "-"}, ${d.street || "-"}`);
  lines.push(`${d.landmark || "-"}, ${d.mandal || "-"}, ${d.district || "-"}`);
  if (d.note) lines.push(`Note: ${d.note}`);
  lines.push("");
  lines.push("Thank you for shopping with us! 🙏");

  return lines.join("\n");
}

function shareViaWhatsApp(order) {
  const phoneDigits = String(order.customerPhone || "").replace(/\D/g, "");
  if (!phoneDigits) return;
  const fullNumber = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const text = encodeURIComponent(buildWhatsAppBillText(order));
  const url = `https://wa.me/${fullNumber}?text=${text}`;
  window.open(url, "_blank", "noopener");
}

function formatExpiryShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { month: "2-digit", year: "numeric" });
}

function buildReceiptHTML(order) {
  const placed = (order.placedAt instanceof Date ? order.placedAt : new Date()).toLocaleString();
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

function printReceipt(order) {
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

navOrdersBtn.addEventListener("click", () => {
  toggleDrawer(ordersDrawer, ordersBackdrop, true);
  loadOrders();
});
closeOrdersBtn.addEventListener("click", () => toggleDrawer(ordersDrawer, ordersBackdrop, false));
ordersBackdrop.addEventListener("click", () => toggleDrawer(ordersDrawer, ordersBackdrop, false));

let ordersUnsubscribe = null;

function loadOrders() {
  const session = getSession();
  if (!session) return;

  if (!db || !firebaseFns) {
    ordersBody.innerHTML = `<p class="empty-state">Orders aren't connected yet — please try again in a moment.</p>`;
    return;
  }

  ordersBody.innerHTML = `<p class="loading-state">Loading your orders…</p>`;

  if (ordersUnsubscribe) ordersUnsubscribe();

  const ordersQuery = firebaseFns.query(
    firebaseFns.collection(db, "orders"),
    firebaseFns.where("customerPhone", "==", session.phone),
    firebaseFns.orderBy("createdAt", "desc")
  );

  ordersUnsubscribe = firebaseFns.onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderOrders(orders);
    },
    (err) => {
      ordersBody.innerHTML = `<p class="empty-state">Couldn't load orders: ${escapeHtml(err.message)}</p>`;
    }
  );
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersBody.innerHTML = `<p class="loading-state">No orders yet — go place your first one!</p>`;
    return;
  }
  ordersBody.innerHTML = orders
    .map((o) => {
      const itemsSummary = Array.isArray(o.items)
        ? o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")
        : "—";
      const placed = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString() : "Just now";
      const status = o.status || "pending";
      const isImageAttachment = o.attachment && o.attachment.type && o.attachment.type.startsWith("image/");
      const attachmentTag = o.attachment
        ? isImageAttachment
          ? `<a href="${o.attachment.url}" target="_blank" rel="noopener"><img src="${o.attachment.url}" alt="${escapeHtml(o.attachment.name)}" class="order-attachment-thumb" /></a>`
          : `<p class="order-items">📎 <a href="${o.attachment.url}" target="_blank" rel="noopener">${escapeHtml(o.attachment.name)}</a></p>`
        : "";
      return `
        <div class="order-card">
          <div class="order-card-head">
            <strong>₹${Number(o.total || 0).toFixed(2)}</strong>
            <span class="status-pill ${status}">${status}</span>
          </div>
          <p class="order-items">${escapeHtml(itemsSummary)}</p>
          ${attachmentTag}
          <p class="order-meta">${placed}</p>
        </div>`;
    })
    .join("");
}
