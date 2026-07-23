// ============================================================================
// CONFIG — fill these in with your own project credentials before deploying.
// ============================================================================

// Firebase: used for admin login (Auth) and orders (Firestore).
// Get this object from Firebase Console → Project settings → General → Your apps.
const firebaseConfig = {
  apiKey: "AIzaSyDDwC_AojbttZKz9LmKk-7wH46yS6cq9Ic",
  authDomain: "rajeshwarimedical-78b78.firebaseapp.com",
  projectId: "rajeshwarimedical-78b78",
  storageBucket: "rajeshwarimedical-78b78.firebasestorage.app",
  messagingSenderId: "818567753854",
  appId: "1:818567753854:web:65509e76ac464cfcf0282f",
  measurementId: "G-0CJJHQKZWS",
};

// Supabase: used for products (inventory) only.
// Get these from Supabase dashboard → Project settings → API.
const SUPABASE_URL = "https://eqqxjfzokwqsamznvikb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcXhqZnpva3dxc2Ftem52aWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDI2MTIsImV4cCI6MjEwMDM3ODYxMn0.dOcs7w0B7Iw99B4-sXbi1ZLas08hg3xUrrkYyUuN3Po";

// Product writes (insert/update/delete) go through this Edge Function, which
// checks the caller's Firebase login before touching the database. Reads go
// straight to Supabase since the products table allows public SELECT.
const PRODUCTS_ADMIN_FN_URL = `${SUPABASE_URL}/functions/v1/products-admin`;

// Expected Supabase table: "products"
//   id (uuid, pk, default gen_random_uuid())
//   name (text), sku (text), category (text), price (numeric), stock (int)
//   created_at (timestamptz, default now())
//
// Expected Firestore collection: "orders"
//   customerName (string), items (array), total (number),
//   createdAt (timestamp), status ("pending" | "fulfilled" | "cancelled")

// ============================================================================
// Firebase setup (modular SDK via CDN)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Analytics only works in supported browser contexts (https, not blocked by
// an ad-blocker, etc.) — guard it so it never breaks the dashboard.
isAnalyticsSupported().then((supported) => {
  if (supported) getAnalytics(firebaseApp);
});

// ============================================================================
// Supabase setup (UMD build loaded as window.supabase in index.html)
// ============================================================================
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// Element refs
// ============================================================================
const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const phoneForm = document.getElementById("phone-form");
const phoneError = document.getElementById("phone-error");
const otpForm = document.getElementById("otp-form");
const otpError = document.getElementById("otp-error");
const otpPhoneDisplay = document.getElementById("otp-phone-display");
const changeNumberBtn = document.getElementById("change-number-btn");
const logoutBtn = document.getElementById("logout-btn");
const currentUserEl = document.getElementById("current-user");

const navBtns = document.querySelectorAll(".nav-btn");
const tabPanels = {
  products: document.getElementById("tab-products"),
  orders: document.getElementById("tab-orders"),
};

const productsTbody = document.getElementById("products-tbody");
const productsError = document.getElementById("products-error");
const addProductBtn = document.getElementById("add-product-btn");
const productFormWrap = document.getElementById("product-form-wrap");
const productForm = document.getElementById("product-form");
const productFormTitle = document.getElementById("product-form-title");
const cancelProductBtn = document.getElementById("cancel-product-btn");

const ordersTbody = document.getElementById("orders-tbody");
const ordersError = document.getElementById("orders-error");

let ordersUnsubscribe = null;

// ============================================================================
// Auth
// ============================================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.hidden = true;
    dashboardScreen.hidden = false;
    currentUserEl.textContent = user.phoneNumber || "Admin";
    loadProducts();
    subscribeToOrders();
  } else {
    dashboardScreen.hidden = true;
    loginScreen.hidden = false;
    resetToPhoneStep();
    if (ordersUnsubscribe) ordersUnsubscribe();
  }
});

let recaptchaVerifier = null;
let confirmationResult = null;

function getRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
  }
  return recaptchaVerifier;
}

function resetToPhoneStep() {
  otpForm.hidden = true;
  phoneForm.hidden = false;
  phoneForm.reset();
  otpForm.reset();
  phoneError.hidden = true;
  otpError.hidden = true;
  confirmationResult = null;
}

phoneForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  phoneError.hidden = true;
  const phone = document.getElementById("phone").value.trim();

  try {
    confirmationResult = await signInWithPhoneNumber(auth, phone, getRecaptcha());
    otpPhoneDisplay.textContent = phone;
    phoneForm.hidden = true;
    otpForm.hidden = false;
    document.getElementById("otp").focus();
  } catch (err) {
    phoneError.textContent = friendlyAuthError(err);
    phoneError.hidden = false;
    // Reset the widget so the next attempt gets a fresh challenge.
    if (recaptchaVerifier) {
      recaptchaVerifier.render().then((widgetId) => {
        if (window.grecaptcha) window.grecaptcha.reset(widgetId);
      });
    }
  }
});

otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  otpError.hidden = true;
  const code = document.getElementById("otp").value.trim();

  if (!confirmationResult) {
    otpError.textContent = "Session expired — please request a new code.";
    otpError.hidden = false;
    return;
  }

  try {
    await confirmationResult.confirm(code);
    // onAuthStateChanged handles the transition to the dashboard.
  } catch (err) {
    otpError.textContent = friendlyAuthError(err);
    otpError.hidden = false;
  }
});

changeNumberBtn.addEventListener("click", resetToPhoneStep);

logoutBtn.addEventListener("click", () => signOut(auth));

function friendlyAuthError(err) {
  const code = err && err.code ? err.code : "";
  if (code.includes("invalid-verification-code")) return "That code isn't right. Please try again.";
  if (code.includes("code-expired")) return "That code expired — request a new one.";
  if (code.includes("invalid-phone-number")) return "Enter the number with country code, e.g. +91...";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again later.";
  if (code.includes("quota-exceeded")) return "Daily SMS limit reached for this project. Try again tomorrow.";
  return "Couldn't sign in. Please try again.";
}

// ============================================================================
// Tabs
// ============================================================================
navBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    navBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.entries(tabPanels).forEach(([key, panel]) => {
      panel.hidden = key !== btn.dataset.tab;
    });
  });
});

// ============================================================================
// Products (Supabase reads direct, writes via Edge Function gatekeeper)
// ============================================================================
async function callProductsAdmin(action, { id, product } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();

  const res = await fetch(PRODUCTS_ADMIN_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, id, product }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body.data;
}
async function loadProducts() {
  productsError.hidden = true;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    productsError.textContent = "Couldn't load products: " + error.message;
    productsError.hidden = false;
    productsTbody.innerHTML = "";
    return;
  }
  renderProducts(data || []);
}

function stockClass(stock) {
  if (stock < 5) return "low";
  if (stock < 20) return "mid";
  return "ok";
}

function renderProducts(products) {
  if (products.length === 0) {
    productsTbody.innerHTML = `<tr class="empty-row"><td colspan="7">No products yet. Add your first one above.</td></tr>`;
    return;
  }
  productsTbody.innerHTML = products
    .map((p) => {
      const cls = stockClass(p.stock);
      return `
        <tr data-id="${p.id}">
          <td><span class="stock-strip ${cls}"></span></td>
          <td>${escapeHtml(p.name)}</td>
          <td class="sku-cell">${escapeHtml(p.sku)}</td>
          <td>${escapeHtml(p.category)}</td>
          <td>₹${Number(p.price).toFixed(2)}</td>
          <td><span class="stock-strip ${cls}">${p.stock}</span></td>
          <td>
            <div class="row-actions">
              <button class="edit-btn" data-id="${p.id}">Edit</button>
              <button class="delete-btn" data-id="${p.id}">Delete</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  productsTbody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditForm(products.find((p) => p.id === btn.dataset.id)));
  });
  productsTbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteProduct(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

addProductBtn.addEventListener("click", () => openAddForm());
cancelProductBtn.addEventListener("click", () => closeProductForm());

function openAddForm() {
  productForm.reset();
  document.getElementById("product-id").value = "";
  productFormTitle.textContent = "Add product";
  productFormWrap.hidden = false;
}

function openEditForm(product) {
  if (!product) return;
  document.getElementById("product-id").value = product.id;
  document.getElementById("p-name").value = product.name;
  document.getElementById("p-sku").value = product.sku;
  document.getElementById("p-category").value = product.category;
  document.getElementById("p-price").value = product.price;
  document.getElementById("p-stock").value = product.stock;
  productFormTitle.textContent = "Edit product";
  productFormWrap.hidden = false;
}

function closeProductForm() {
  productFormWrap.hidden = true;
  productForm.reset();
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  productsError.hidden = true;

  const id = document.getElementById("product-id").value;
  const payload = {
    name: document.getElementById("p-name").value.trim(),
    sku: document.getElementById("p-sku").value.trim(),
    category: document.getElementById("p-category").value.trim(),
    price: parseFloat(document.getElementById("p-price").value),
    stock: parseInt(document.getElementById("p-stock").value, 10),
  };

  try {
    await callProductsAdmin(id ? "update" : "insert", { id: id || undefined, product: payload });
  } catch (err) {
    productsError.textContent = "Couldn't save product: " + err.message;
    productsError.hidden = false;
    return;
  }

  closeProductForm();
  loadProducts();
});

async function deleteProduct(id) {
  if (!confirm("Delete this product? This can't be undone.")) return;
  try {
    await callProductsAdmin("delete", { id });
  } catch (err) {
    productsError.textContent = "Couldn't delete product: " + err.message;
    productsError.hidden = false;
    return;
  }
  loadProducts();
}

// ============================================================================
// Orders (Firestore, read + status update)
// ============================================================================
function subscribeToOrders() {
  ordersError.hidden = true;
  const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"));

  ordersUnsubscribe = onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderOrders(orders);
    },
    (err) => {
      ordersError.textContent = "Couldn't load orders: " + err.message;
      ordersError.hidden = false;
    }
  );
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersTbody.innerHTML = `<tr class="empty-row"><td colspan="6">No orders yet.</td></tr>`;
    return;
  }
  ordersTbody.innerHTML = orders
    .map((o) => {
      const itemsSummary = Array.isArray(o.items)
        ? o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")
        : "—";
      const placed = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString() : "—";
      const status = o.status || "pending";
      return `
        <tr data-id="${o.id}">
          <td class="sku-cell">${o.id.slice(0, 8)}</td>
          <td>${escapeHtml(o.customerName || "—")}</td>
          <td>${escapeHtml(itemsSummary)}</td>
          <td>₹${Number(o.total || 0).toFixed(2)}</td>
          <td>${placed}</td>
          <td>
            <select class="status-select" data-id="${o.id}">
              <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
              <option value="fulfilled" ${status === "fulfilled" ? "selected" : ""}>Fulfilled</option>
              <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </td>
        </tr>`;
    })
    .join("");

  ordersTbody.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await updateDoc(doc(db, "orders", select.dataset.id), { status: select.value });
      } catch (err) {
        ordersError.textContent = "Couldn't update order status: " + err.message;
        ordersError.hidden = false;
      }
    });
  });
}
