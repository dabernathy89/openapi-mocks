// Simple SPA router for the Acme demo app.
// Routes: /users, /users/:id, /users/new, /dashboard
//
// The API base URL is the same origin as the app server.
// Playwright intercepts these same-origin API calls using page.route().

const API_BASE = "/api/v1";

function show(id) {
  for (const el of document.querySelectorAll("#app > div")) {
    el.style.display = "none";
  }
  document.getElementById(id).style.display = "block";
}

async function renderUsers(cursor) {
  const url = cursor ? `${API_BASE}/users?cursor=${cursor}` : `${API_BASE}/users`;
  const res = await fetch(url);
  const data = await res.json();

  show("user-list");

  const container = document.getElementById("users-container");
  container.innerHTML = "";

  for (const user of data.users ?? []) {
    const card = document.createElement("div");
    card.className = "user-card";
    card.dataset.testid = "user-card";

    let addressesHtml = "";
    if (user.addresses) {
      for (const addr of user.addresses) {
        addressesHtml += `<div class="address" data-testid="address">${addr.street}, ${addr.city} ${addr.zip ?? ""}</div>`;
      }
    }

    card.innerHTML = `
      <strong>${user.name}</strong> &lt;${user.email}&gt;
      ${addressesHtml}
    `;
    container.appendChild(card);
  }

  // Pagination
  const currentPageEl = document.querySelector("[data-testid='current-page']");
  const totalPagesEl = document.querySelector("[data-testid='total-pages']");
  const nextLink = document.getElementById("next-link");

  if (currentPageEl) currentPageEl.textContent = String(data.page ?? 1);
  if (totalPagesEl) totalPagesEl.textContent = String(data.totalPages ?? 1);

  if (nextLink) {
    if (data.nextPage) {
      nextLink.style.display = "inline";
      nextLink.onclick = (e) => {
        e.preventDefault();
        renderUsers(String(data.nextPage));
      };
    } else {
      nextLink.style.display = "none";
    }
  }
}

async function renderUserDetail(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}`);
  const data = await res.json();

  show("user-detail");

  document.querySelector("[data-testid='user-id']").textContent = data.id ?? userId;
  document.querySelector("[data-testid='user-name']").textContent = data.name ?? "";
  document.querySelector("[data-testid='user-email']").textContent = data.email ?? "";
}

async function renderCreateUserForm() {
  show("create-user-form");

  const form = document.getElementById("create-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.email.value;
    const username = form.username.value;

    // Clear previous errors
    for (const el of document.querySelectorAll(".error")) {
      el.style.display = "none";
      el.textContent = "";
    }

    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username }),
    });

    if (res.status === 422) {
      const data = await res.json();
      for (const err of data.fieldErrors ?? []) {
        const el = document.querySelector(`[data-testid="field-error-${err.field}"]`);
        if (el) {
          el.textContent = err.message;
          el.style.display = "block";
        }
      }
    } else if (res.ok) {
      window.location.href = "/users";
    }
  };
}

async function renderDashboard() {
  show("dashboard");

  // Fetch users
  const usersRes = await fetch(`${API_BASE}/users`);
  const usersData = await usersRes.json();
  document.querySelector("[data-testid='user-count']").textContent =
    String((usersData.users ?? []).length);

  // Fetch orders if endpoint exists
  try {
    const ordersRes = await fetch(`${API_BASE}/orders`);
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json();
      document.querySelector("[data-testid='order-count']").textContent =
        String((ordersData.orders ?? []).length);
    }
  } catch {
    document.querySelector("[data-testid='order-count']").textContent = "0";
  }
}

// Simple router
function route() {
  const path = window.location.pathname;

  if (path === "/users/new") {
    renderCreateUserForm();
  } else if (path.startsWith("/users/")) {
    const userId = path.replace("/users/", "");
    renderUserDetail(userId);
  } else if (path === "/users" || path === "/") {
    renderUsers();
  } else if (path === "/dashboard") {
    renderDashboard();
  }
}

route();
window.addEventListener("popstate", route);
