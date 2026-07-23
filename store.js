give me full script for all the buttons work and run // ============================================================================
// CONFIG — reuses the same Firebase + Supabase project as the admin console.
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

// Where the Admin Login form should send staff after a *successful* login.
// Adjust to whatever your admin console file is actually named/hosted at.
const ADMIN_CONSOLE_URL = "admin.html";

// A generic placeholder image for products that don't have one in the DB.
// If you add an "image_url" column to the products table it will be used
// automatically instead.
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=400&auto=format&fit=crop";

// ============================================================================
// IMPORTANT FIXES IN THIS VERSION
// ----------------------------------------------------------------------------
// 1) SCREEN SWITCHING BUG (the reported issue)
//    The login card and the shop page were both visible at once. This was a
//    CSS specificity bug, not a JS bug: #login-screen / #shop-screen set
//    `display:flex` on an ID selector, which beat the generic
//    `.screen[hidden] { display:none }` rule. So toggling the `hidden`
//    attribute here in JS never actually hid anything. Fixed in store.css
//    with `#id[hidden] { display: none !important; }` for every screen.
//
// 2) ADMIN LOGIN
//    "Admin Login" previously navigated straight to another page. It now
//    shows an in-app Admin Login screen (same card styling as the customer
//    login) with Username + Password. On submit it does a lightweight
//    client-side check and then hands off to the real admin console at
//    ADMIN_CONSOLE_URL. Wire the TODO below up to your real auth (Firebase
//    Auth / Supabase Auth) when ready.
//
// Firebase/Supabase are initialised separately, inside try/catch, using a
// dynamic import() for Firebase, so a slow/blocked CDN never blocks login,
// browsing, or the cart — you just see a small banner instead.
// ============================================================================

// ============================================================================
// Local "customer session" — name + phone, stored on this device.
// ============================================================================
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

// ============================================================================
// Element refs
// ============================================================================
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

const navOrdersBtn = document.getElementById("nav-orders");
const closeOrdersBtn = document.getElementById("close-orders-btn");
const ordersBackdrop = document.getElementById("orders-backdrop");
const ordersDrawer = document.getElementById("orders-drawer");
const ordersBody = document.getElementById("orders-body");

let allProducts = [];

// Backend handles — filled in by initBackend() if it succeeds. Every
// function that uses them checks for null first, so a failed/slow backend
// never blocks login, browsing the (empty) grid, or the cart drawer.
let db = null;
let supabaseClient = null;
let firebaseFns = null; // { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp }

function showBackendWarning(message) {
  if (!backendWarning) return;
  backendWarning.textContent = message;
  backendWarning.hidden = false;
}

// ============================================================================
// Screen helper — makes sure exactly one top-level screen is visible.
// ============================================================================
function showScreen(name) {
  loginScreen.hidden = name !== "login";
  adminLoginScreen.hidden = name !== "admin-login";
  shopScreen.hidden = name !== "shop";
}

// ============================================================================
// Boot — login/shop toggle + cart wiring first, no backend dependency.
// ============================================================================
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
  enterShop(session); // <-- this is the redirect: hides login, shows the shop
});

function enterShop(session) {
  showScreen("shop");
  userChip.textContent = session.name || session.phone;
  renderCartFromStorage();
  loadProducts(); // safe no-op / friendly error if backend isn't ready
}

logoutBtn.addEventListener("click", () => {
  clearSession();
  loginForm.reset();
  showScreen("login");
});

// ============================================================================
// Admin login (client-side gate — swap the TODO for real Firebase/Supabase
// auth when you're ready; this just controls hand-off to the admin console).
// ============================================================================
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

  // TODO: replace with real authentication (e.g. Firebase Auth
  // signInWithEmailAndPassword, or a Supabase Auth call) before going live.
  window.location.href = ADMIN_CONSOLE_URL;
});

// ============================================================================
// Backend init (Firebase + Supabase) — isolated so a failure here can never
// stop the store screen from opening.
// ============================================================================
async function initBackend() {
  // Supabase client (loaded as a classic <script> before this module, so
  // window.supabase should already exist — but guard it anyway).
  try {
    if (!window.supabase) {
      throw new Error("Supabase library did not load.");
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Supabase init failed:", err);
    supabaseClient = null;
  }

  // Firebase, via dynamic import so a network/CDN failure can't take down
  // the rest of the script.
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

  // Products depend on Supabase only, so try loading them once the client
  // is ready even if this resolves after the shop screen is already open.
  if (supabaseClient && !shopScreen.hidden) {
    loadProducts();
  }
}

initBackend();

// ============================================================================
// Products (Supabase, public read)
// ============================================================================
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

// ============================================================================
// Cart drawer (fully local — works regardless of backend state)
// ============================================================================
function renderCartFromStorage() {
  const cart = getCart();
  const entries = Object.entries(cart);
  const totalQty = entries.reduce((sum, [, item]) => sum + item.qty, 0);
  const totalPrice = entries.reduce((sum, [, item]) => sum + item.qty * item.price, 0);

  cartCountEl.textContent = totalQty;
  cartTotalEl.textContent = `₹${totalPrice.toFixed(2)}`;
  checkoutBtn.disabled = totalQty === 0;

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

openCartBtn.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, true));
closeCartBtn.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, false));
cartBackdrop.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, false));

function toggleDrawer(drawer, backdrop, show) {
  drawer.hidden = !show;
  backdrop.hidden = !show;
}

checkoutBtn.addEventListener("click", async () => {
  const session = getSession();
  const cart = getCart();
  const entries = Object.entries(cart);
  if (!session || entries.length === 0) return;

  if (!db || !firebaseFns) {
    alert("Orders aren't connected yet — please try again in a moment.");
    return;
  }

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Placing order…";

  const items = entries.map(([id, item]) => ({
    productId: id,
    name: item.name,
    qty: item.qty,
    price: item.price,
  }));
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  try {
    await firebaseFns.addDoc(firebaseFns.collection(db, "orders"), {
      customerName: session.name,
      customerPhone: session.phone,
      items,
      total,
      status: "pending",
      createdAt: firebaseFns.serverTimestamp(),
    });
    setCart({});
    renderCartFromStorage();
    renderGrid(allProducts);
    toggleDrawer(cartDrawer, cartBackdrop, false);
    alert("Order placed! You can track it under Previous Orders.");
  } catch (err) {
    alert("Couldn't place order: " + err.message);
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Place Order";
  }
});

// ============================================================================
// Previous orders (Firestore, filtered to this customer's phone number)
// ============================================================================
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
      return `
        <div class="order-card">
          <div class="order-card-head">
            <strong>₹${Number(o.total || 0).toFixed(2)}</strong>
            <span class="status-pill ${status}">${status}</span>
          </div>
          <p class="order-items">${escapeHtml(itemsSummary)}</p>
          <p class="order-meta">${placed}</p>
        </div>`;
    })
    .join("");
}// ============================================================================
// CONFIG — reuses the same Firebase + Supabase project as the admin console.
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

// Where the Admin Login form should send staff after a *successful* login.
// Adjust to whatever your admin console file is actually named/hosted at.
const ADMIN_CONSOLE_URL = "admin.html";

// A generic placeholder image for products that don't have one in the DB.
// If you add an "image_url" column to the products table it will be used
// automatically instead.
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=400&auto=format&fit=crop";

// ============================================================================
// IMPORTANT FIXES IN THIS VERSION
// ----------------------------------------------------------------------------
// 1) SCREEN SWITCHING BUG (the reported issue)
//    The login card and the shop page were both visible at once. This was a
//    CSS specificity bug, not a JS bug: #login-screen / #shop-screen set
//    `display:flex` on an ID selector, which beat the generic
//    `.screen[hidden] { display:none }` rule. So toggling the `hidden`
//    attribute here in JS never actually hid anything. Fixed in store.css
//    with `#id[hidden] { display: none !important; }` for every screen.
//
// 2) ADMIN LOGIN
//    "Admin Login" previously navigated straight to another page. It now
//    shows an in-app Admin Login screen (same card styling as the customer
//    login) with Username + Password. On submit it does a lightweight
//    client-side check and then hands off to the real admin console at
//    ADMIN_CONSOLE_URL. Wire the TODO below up to your real auth (Firebase
//    Auth / Supabase Auth) when ready.
//
// Firebase/Supabase are initialised separately, inside try/catch, using a
// dynamic import() for Firebase, so a slow/blocked CDN never blocks login,
// browsing, or the cart — you just see a small banner instead.
// ============================================================================

// ============================================================================
// Local "customer session" — name + phone, stored on this device.
// ============================================================================
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

// ============================================================================
// Element refs
// ============================================================================
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

const navOrdersBtn = document.getElementById("nav-orders");
const closeOrdersBtn = document.getElementById("close-orders-btn");
const ordersBackdrop = document.getElementById("orders-backdrop");
const ordersDrawer = document.getElementById("orders-drawer");
const ordersBody = document.getElementById("orders-body");

let allProducts = [];

// Backend handles — filled in by initBackend() if it succeeds. Every
// function that uses them checks for null first, so a failed/slow backend
// never blocks login, browsing the (empty) grid, or the cart drawer.
let db = null;
let supabaseClient = null;
let firebaseFns = null; // { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp }

function showBackendWarning(message) {
  if (!backendWarning) return;
  backendWarning.textContent = message;
  backendWarning.hidden = false;
}

// ============================================================================
// Screen helper — makes sure exactly one top-level screen is visible.
// ============================================================================
function showScreen(name) {
  loginScreen.hidden = name !== "login";
  adminLoginScreen.hidden = name !== "admin-login";
  shopScreen.hidden = name !== "shop";
}

// ============================================================================
// Boot — login/shop toggle + cart wiring first, no backend dependency.
// ============================================================================
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
  enterShop(session); // <-- this is the redirect: hides login, shows the shop
});

function enterShop(session) {
  showScreen("shop");
  userChip.textContent = session.name || session.phone;
  renderCartFromStorage();
  loadProducts(); // safe no-op / friendly error if backend isn't ready
}

logoutBtn.addEventListener("click", () => {
  clearSession();
  loginForm.reset();
  showScreen("login");
});

// ============================================================================
// Admin login (client-side gate — swap the TODO for real Firebase/Supabase
// auth when you're ready; this just controls hand-off to the admin console).
// ============================================================================
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

  // TODO: replace with real authentication (e.g. Firebase Auth
  // signInWithEmailAndPassword, or a Supabase Auth call) before going live.
  window.location.href = ADMIN_CONSOLE_URL;
});

// ============================================================================
// Backend init (Firebase + Supabase) — isolated so a failure here can never
// stop the store screen from opening.
// ============================================================================
async function initBackend() {
  // Supabase client (loaded as a classic <script> before this module, so
  // window.supabase should already exist — but guard it anyway).
  try {
    if (!window.supabase) {
      throw new Error("Supabase library did not load.");
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Supabase init failed:", err);
    supabaseClient = null;
  }

  // Firebase, via dynamic import so a network/CDN failure can't take down
  // the rest of the script.
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

  // Products depend on Supabase only, so try loading them once the client
  // is ready even if this resolves after the shop screen is already open.
  if (supabaseClient && !shopScreen.hidden) {
    loadProducts();
  }
}

initBackend();

// ============================================================================
// Products (Supabase, public read)
// ============================================================================
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

// ============================================================================
// Cart drawer (fully local — works regardless of backend state)
// ============================================================================
function renderCartFromStorage() {
  const cart = getCart();
  const entries = Object.entries(cart);
  const totalQty = entries.reduce((sum, [, item]) => sum + item.qty, 0);
  const totalPrice = entries.reduce((sum, [, item]) => sum + item.qty * item.price, 0);

  cartCountEl.textContent = totalQty;
  cartTotalEl.textContent = `₹${totalPrice.toFixed(2)}`;
  checkoutBtn.disabled = totalQty === 0;

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

openCartBtn.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, true));
closeCartBtn.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, false));
cartBackdrop.addEventListener("click", () => toggleDrawer(cartDrawer, cartBackdrop, false));

function toggleDrawer(drawer, backdrop, show) {
  drawer.hidden = !show;
  backdrop.hidden = !show;
}

checkoutBtn.addEventListener("click", async () => {
  const session = getSession();
  const cart = getCart();
  const entries = Object.entries(cart);
  if (!session || entries.length === 0) return;

  if (!db || !firebaseFns) {
    alert("Orders aren't connected yet — please try again in a moment.");
    return;
  }

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Placing order…";

  const items = entries.map(([id, item]) => ({
    productId: id,
    name: item.name,
    qty: item.qty,
    price: item.price,
  }));
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  try {
    await firebaseFns.addDoc(firebaseFns.collection(db, "orders"), {
      customerName: session.name,
      customerPhone: session.phone,
      items,
      total,
      status: "pending",
      createdAt: firebaseFns.serverTimestamp(),
    });
    setCart({});
    renderCartFromStorage();
    renderGrid(allProducts);
    toggleDrawer(cartDrawer, cartBackdrop, false);
    alert("Order placed! You can track it under Previous Orders.");
  } catch (err) {
    alert("Couldn't place order: " + err.message);
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Place Order";
  }
});

// ============================================================================
// Previous orders (Firestore, filtered to this customer's phone number)
// ============================================================================
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
      return `
        <div class="order-card">
          <div class="order-card-head">
            <strong>₹${Number(o.total || 0).toFixed(2)}</strong>
            <span class="status-pill ${status}">${status}</span>
          </div>
          <p class="order-items">${escapeHtml(itemsSummary)}</p>
          <p class="order-meta">${placed}</p>
        </div>`;
    })
    .join("");
}
