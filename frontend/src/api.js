const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${
        window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
      }:8000/api`
    : "http://127.0.0.1:8000/api");

const tokenStore = {
  get access() {
    return localStorage.getItem("access_token") || "";
  },
  get refresh() {
    return localStorage.getItem("refresh_token") || "";
  },
  set(access, refresh) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  },
  clear() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
};

async function refreshAccessToken() {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh })
  });

  if (!res.ok) {
    tokenStore.clear();
    return false;
  }

  const data = await res.json();
  tokenStore.set(data.access, refresh);
  return true;
}

export async function apiRequest(path, options = {}, retry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (err) {
    const reason = err?.message ? ` (${err.message})` : "";
    throw new Error(`Network error. Could not reach API at ${API_BASE}${reason}`);
  }

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest(path, options, false);
    }
  }

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch {
      detail = `${res.status} ${res.statusText}`;
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function apiFetch(path, options = {}, retry = true) {
  const headers = {
    ...(options.headers || {})
  };
  if (tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, false);  
    }
  }
  return res;
}

export async function login(username, password) {
  const data = await apiRequest(
    "/auth/login/",
    {
      method: "POST",
      body: JSON.stringify({ username, password })
    },
    false
  );
  tokenStore.set(data.access, data.refresh);
  return data.user;
}

export async function register(username, email, password) {
  return apiRequest(
    "/auth/register/",
    {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    },
    false
  );
}

export async function registerCashier(username, email, password) {
  return apiRequest(
    "/auth/register-cashier/",
    {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    }
  );
}

export async function logout() {
  const refresh = tokenStore.refresh;
  if (refresh) {
    try {
      await apiRequest("/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh })
      });
    } catch {
      // Clear local auth state even if server-side revoke fails.
    }
  }
  tokenStore.clear();
}

export async function currentUser() {
  return apiRequest("/auth/me/");
}

export function hasSession() {
  return Boolean(tokenStore.access && tokenStore.refresh);
}
