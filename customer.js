// ============================================================================
// Shared helpers for the customer-facing pages (login.html, shop.html)
// and the admin login gate (admin-login.html).
//
// Customer identity here is just "who's ordering" (name + phone), stored
// locally — it is NOT a secure login. If you later want customers to be able
// to see past orders from any device, swap this for real Firebase phone-auth
// like the admin dashboard already uses.
// ============================================================================

const CUSTOMER_SESSION_KEY = "customerSession";
const CART_KEY = "customerCart";
const ADMIN_SESSION_KEY = "adminSession";

function getCustomerSession() {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCustomerSession(session) {
  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
}

function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  localStorage.removeItem(CART_KEY);
}

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartItemCount() {
  const cart = getCart();
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

// ---- Admin session (hardcoded credential check) ----------------------------
// NOTE: This checks the username/password in plain client-side JavaScript.
// Anyone can read this file from the browser's dev tools, so this is only
// a UI gate, not real security. Don't reuse this password anywhere sensitive.
const ADMIN_USERNAME = "KataSudhasari";
const ADMIN_PASSWORD = "9640456494@s";

function checkAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function setAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
}

function hasAdminSession() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
