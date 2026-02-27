import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiRequest, currentUser, hasSession, login, logout, register, registerCashier } from "./api";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Card payment" }
];

function LoginForm({ onLogin, onSwitchToRegister, initialUsername = "" }) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="system-page">
      <header className="system-header">
        <span className="system-title">Payment Management System</span>
      </header>
      <div className="auth-shell">
        <form className="panel auth-panel" onSubmit={submit}>
          <div className="auth-heading">
            <span className="kicker">Secure Workspace</span>
            <h1>Payment Management</h1>
            <p>Sign in to continue</p>
          </div>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <div className="error-box">{error}</div> : null}
          <button disabled={loading} type="submit">
            {loading ? "Signing in..." : "Login"}
          </button>
          <p className="auth-switch">
            No account?{" "}
            <button type="button" className="link-btn" onClick={onSwitchToRegister}>
              Register
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

function RegisterForm({ onSwitchToLogin, onRegistered }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      await register(username, email, password);
      setMessage("Registration successful. You can now log in.");
      onRegistered(username);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="system-page">
      <header className="system-header">
        <span className="system-title">Payment Management System</span>
      </header>
      <div className="auth-shell">
        <form className="panel auth-panel" onSubmit={submit}>
          <div className="auth-heading">
            <span className="kicker">New Account</span>
            <h1>Create Account</h1>
            <p>Register as a normal user</p>
          </div>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error ? <div className="error-box">{error}</div> : null}
          {message ? <div className="ok-box">{message}</div> : null}
          <button disabled={loading} type="submit">
            {loading ? "Creating account..." : "Register"}
          </button>
          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" className="link-btn" onClick={onSwitchToLogin}>
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <header className="section-head">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

function AnimatedCounter({ value, decimals = 0, prefix = "", suffix = "" }) {
  const numericValue = Number(value);
  const [display, setDisplay] = useState(Number.isFinite(numericValue) ? 0 : value);

  useEffect(() => {
    if (!Number.isFinite(numericValue)) {
      setDisplay(value);
      return;
    }
    const duration = 800;
    const start = performance.now();
    let frame;
    const tick = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const next = numericValue * progress;
      setDisplay(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numericValue, value]);

  if (!Number.isFinite(numericValue)) {
    return <>{String(display)}</>;
  }
  return (
    <>
      {prefix}
      {Number(display).toFixed(decimals)}
      {suffix}
    </>
  );
}

function StatCard({ label, value, trend = "", trendUp = true, decimals = 0, prefix = "", suffix = "" }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>
        <AnimatedCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </strong>
      {trend ? (
        <em className={trendUp ? "trend up" : "trend down"}>
          {trendUp ? "↑" : "↓"} {trend}
        </em>
      ) : null}
    </article>
  );
}

function AdminOverviewPanel({
  user,
  roles,
  activeSection,
  onSectionChange,
  showPaymentPanel,
  canRegisterCashier,
  canViewUsers,
  collapsed,
  onToggle
}) {
  const isSuperAdmin = roles.includes("admin") || user?.is_superuser;

  return (
    <aside className={collapsed ? "overview-panel collapsed" : "overview-panel"}>
      <div className="sidebar-head">
        <h4 className="overview-title">PaySystem</h4>
        <button type="button" className="sidebar-toggle desktop-only" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? "→" : "←"}
        </button>
      </div>
      <div className="overview-identity">
        <span className="kicker">Dashboard</span>
        <p>
          <strong>{user.username}</strong>
          {user.uid ? (
            <>
              <br />
              UID: {user.uid}
            </>
          ) : null}
        </p>
      </div>
      <nav className="overview-nav">
        <button
          type="button"
          className={activeSection === "invoices" ? "sidebar-nav-btn active" : "sidebar-nav-btn"}
          onClick={() => onSectionChange("invoices")}
        >
          <span>Invoice Management</span>
        </button>
        {showPaymentPanel ? (
          <button
            type="button"
            className={activeSection === "payments" ? "sidebar-nav-btn active" : "sidebar-nav-btn"}
            onClick={() => onSectionChange("payments")}
          >
            <span>Payment Recording</span>
          </button>
        ) : null}
        {canRegisterCashier ? (
          <button
            type="button"
            className={activeSection === "cashier-register" ? "sidebar-nav-btn active" : "sidebar-nav-btn"}
            onClick={() => onSectionChange("cashier-register")}
          >
            <span>Register Cashier</span>
          </button>
        ) : null}
        {canViewUsers ? (
          <button
            type="button"
            className={activeSection === "users" ? "sidebar-nav-btn active" : "sidebar-nav-btn"}
            onClick={() => onSectionChange("users")}
          >
            <span>System Users</span>
          </button>
        ) : null}
        {isSuperAdmin ? (
          <button
            type="button"
            className={activeSection === "backup" ? "sidebar-nav-btn active" : "sidebar-nav-btn"}
            onClick={() => onSectionChange("backup")}
          >
            <span>Backup and Recovery</span>
          </button>
        ) : null}
      </nav>
    </aside>
  );
}

function CashierRegistrationPanel() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const created = await registerCashier(username, email, password);
      setMessage(`Cashier created: ${created.username}`);
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" id="cashier-register-section">
      <SectionHeader
        title="Cashier Registration"
        subtitle="Only admin and manager can register cashier accounts."
      />
      <form className="grid-form" onSubmit={submit}>
        <input
          placeholder="Cashier username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Register Cashier"}
        </button>
      </form>
      {message ? <div className="ok-box">{message}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
    </section>
  );
}

function InvoicePanel({ roles, user, refreshToken }) {
  const [list, setList] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [lastPaidInvoiceId, setLastPaidInvoiceId] = useState(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [controlSearch, setControlSearch] = useState("");
  const [controlInvoices, setControlInvoices] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [controlHistory, setControlHistory] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: "",
    payment_method: "cash",
    notes: ""
  });
  const [form, setForm] = useState({ customer: "", amount: "", due_date: "" });
  const [editingId, setEditingId] = useState(null);

  const hasBackofficeAccess = roles.includes("admin") || roles.includes("manager") || user?.is_superuser;
  const isCashierUser = roles.includes("cashier");
  const canEdit = hasBackofficeAccess;
  const canDelete = roles.includes("admin") || user?.is_superuser;
  const canMakePayment = !hasBackofficeAccess;
  const invoiceSubtitle = hasBackofficeAccess ? "" : "Create, update, and track paid/unpaid invoices.";
  const selectedInvoice = list.find((inv) => inv.id === Number(payingInvoiceId));
  const paidCount = list.filter((inv) => inv.status === "paid").length;
  const unpaidCount = list.length - paidCount;
  const totalInvoiceAmount = list.reduce((acc, inv) => acc + Number(inv.amount || 0), 0).toFixed(2);

  async function loadInvoices() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/invoices/");
      setList(data);
      if (canMakePayment && !payingInvoiceId) {
        const firstUnpaid = data.find((inv) => inv.status !== "paid");
        if (firstUnpaid) {
          setPayingInvoiceId(firstUnpaid.id);
          setPaymentForm((prev) => ({
            ...prev,
            amount: firstUnpaid.amount,
            payment_date: new Date().toISOString().slice(0, 10)
          }));
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
    loadUsers();
    if (isCashierUser) {
      loadControlInvoices("");
      loadControlHistory("", "all");
    }
  }, [refreshToken]);

  async function loadUsers() {
    try {
      const data = await apiRequest("/users/directory/");
      setUsers(data);
      if (!form.customer && data.length > 0) {
        setForm((prev) => ({ ...prev, customer: String(data[0].id) }));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadControlInvoices(query = "") {
    try {
      const encoded = encodeURIComponent(query);
      const data = await apiRequest(`/invoices/control_numbers/?q=${encoded}`);
      setControlInvoices(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadControlHistory(query = "", statusValue = "all") {
    try {
      const encodedQuery = encodeURIComponent(query);
      const encodedStatus = encodeURIComponent(statusValue);
      const data = await apiRequest(`/invoices/control_history/?q=${encodedQuery}&status=${encodedStatus}`);
      setControlHistory(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitInvoice(event) {
    event.preventDefault();
    const payload = {
      customer: Number(form.customer),
      amount: form.amount,
      due_date: form.due_date
    };
    const endpoint = editingId ? `/invoices/${editingId}/` : "/invoices/";
    const method = editingId ? "PATCH" : "POST";
    try {
      await apiRequest(endpoint, { method, body: JSON.stringify(payload) });
      setForm((prev) => ({ ...prev, amount: "", due_date: "" }));
      setEditingId(null);
      await loadInvoices();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    try {
      const invoiceId = payingInvoiceId;
      const invoiceAmount = selectedInvoice ? selectedInvoice.amount : paymentForm.amount;
      await apiRequest("/payments/", {
        method: "POST",
        body: JSON.stringify({
          invoice: invoiceId,
          amount: invoiceAmount,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          notes: paymentForm.notes
        })
      });
      setPaymentMessage("Payment recorded successfully.");
      setLastPaidInvoiceId(invoiceId);
      setShowPaymentForm(false);
      setPayingInvoiceId(null);
      await loadInvoices();
    } catch (e) {
      setError(e.message);
    }
  }

  async function generateControlNumber(invoiceId) {
    try {
      const data = await apiRequest(`/invoices/${invoiceId}/generate_control_number/`, {
        method: "POST"
      });
      setPaymentMessage(
        data.generated
          ? `Control number generated: ${data.control_number}`
          : `Control number already exists: ${data.control_number}`
      );
      await loadInvoices();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeInvoice(id) {
    if (!confirm("Delete this invoice?")) return;
    try {
      await apiRequest(`/invoices/${id}/`, { method: "DELETE" });
      await loadInvoices();
    } catch (e) {
      setError(e.message);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      customer: String(item.customer || ""),
      amount: item.amount,
      due_date: item.due_date
    });
  }

  async function downloadInvoice(id) {
    try {
      const res = await apiFetch(`/invoices/${id}/download/`);
      if (!res.ok) {
        throw new Error("Could not download invoice.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="panel" id="invoices-section">
      <SectionHeader title="Invoice Management" subtitle={invoiceSubtitle} />
      <div className="stats-strip">
        <StatCard label="Total" value={list.length} trend="12.3%" trendUp />
        <StatCard label="Paid" value={paidCount} trend="7.1%" trendUp />
        <StatCard label="Unpaid" value={unpaidCount} trend="3.2%" trendUp={false} />
        <StatCard label="Amount" value={totalInvoiceAmount} trend="9.4%" trendUp prefix="$" decimals={2} />
      </div>
      {canEdit ? (
        <form className="grid-form invoice-form" onSubmit={submitInvoice}>
          <select
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
            required
          >
            <option value="" disabled>
              Select user ID
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.uid} ({u.username})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            required
          />
          <button type="submit">{editingId ? "Update invoice" : "Create invoice"}</button>
        </form>
      ) : null}
      {loading ? <p>Loading invoices...</p> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {!isCashierUser ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer UID</th>
                <th>Customer User</th>
                <th>Amount</th>
                <th>Due date</th>
                <th>Status</th>
                <th>Paid</th>
                {!canMakePayment ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>{inv.customer_uid}</td>
                  <td>{inv.customer_username}</td>
                  <td>{inv.amount}</td>
                  <td>{inv.due_date}</td>
                  <td>
                    <span className={inv.status === "paid" ? "pill paid" : "pill unpaid"}>{inv.status}</span>
                  </td>
                  <td>{inv.total_paid}</td>
                  {!canMakePayment ? (
                    <td className="actions-cell">
                      {canEdit ? <button onClick={() => startEdit(inv)}>Edit</button> : null}
                      {canDelete ? (
                        <button className="danger" onClick={() => removeInvoice(inv.id)}>
                          Delete
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {canMakePayment && !isCashierUser ? (
        <div className="backup-actions">
          <button
            type="button"
            onClick={() => {
              if (!showPaymentForm && !payingInvoiceId) {
                const firstUnpaid = list.find((inv) => inv.status !== "paid");
                if (firstUnpaid) {
                  setPayingInvoiceId(firstUnpaid.id);
                  setPaymentForm((prev) => ({
                    ...prev,
                    amount: firstUnpaid.amount,
                    payment_date: new Date().toISOString().slice(0, 10)
                  }));
                }
              }
              setShowPaymentForm((prev) => !prev);
            }}
          >
            {showPaymentForm ? "Hide Payment Form" : "Make Payment"}
          </button>
        </div>
      ) : null}
      {isCashierUser ? (
        <section className="panel">
          <SectionHeader
            title="Control Number Payments"
            subtitle="Search or select generated control numbers from normal users."
          />
          <div className="grid-form">
            <input
              type="text"
              placeholder="Search control number"
              value={controlSearch}
              onChange={(e) => setControlSearch(e.target.value)}
            />
            <button type="button" onClick={() => loadControlInvoices(controlSearch)}>
              Search
            </button>
            <button type="button" onClick={() => loadControlInvoices("")}>
              Show All
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Control Number</th>
                  <th>Invoice ID</th>
                  <th>Customer UID</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {controlInvoices.map((inv) => (
                  <tr key={`control-${inv.id}`}>
                    <td>{inv.control_number}</td>
                    <td>{inv.id}</td>
                    <td>{inv.customer_uid}</td>
                    <td>{inv.amount}</td>
                    <td>{inv.due_date}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setPayingInvoiceId(inv.id);
                          setShowPaymentForm(true);
                          setPaymentForm((prev) => ({
                            ...prev,
                            amount: inv.amount,
                            payment_date: new Date().toISOString().slice(0, 10)
                          }));
                        }}
                      >
                        Pay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SectionHeader
            title="Control Number History"
            subtitle="Search whether a control number is paid or unpaid."
          />
          <div className="grid-form">
            <input
              type="text"
              placeholder="Search control number"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
            <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <button type="button" onClick={() => loadControlHistory(historySearch, historyStatus)}>
              Search History
            </button>
            <button
              type="button"
              onClick={() => {
                setHistorySearch("");
                setHistoryStatus("all");
                loadControlHistory("", "all");
              }}
            >
              Reset
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Control Number</th>
                  <th>Invoice ID</th>
                  <th>Customer UID</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {controlHistory.map((inv) => (
                  <tr key={`history-${inv.id}`}>
                    <td>{inv.control_number}</td>
                    <td>{inv.id}</td>
                    <td>{inv.customer_uid}</td>
                    <td>{inv.amount}</td>
                    <td>
                      <span className={inv.status === "paid" ? "pill paid" : "pill unpaid"}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {canMakePayment && showPaymentForm ? (
        <form className="grid-form payment-form" onSubmit={submitPayment}>
          <strong className="form-title">
            {isCashierUser ? "Cashier Payment Form" : "Payment Form"} (Invoice #{payingInvoiceId})
          </strong>
          <select
            value={payingInvoiceId || ""}
            onChange={(e) => {
              const nextId = Number(e.target.value);
              setPayingInvoiceId(nextId);
              const inv = list.find((item) => item.id === nextId);
              if (inv) {
                setPaymentForm((prev) => ({ ...prev, amount: inv.amount }));
              }
            }}
            required
          >
            <option value="" disabled>
              Select invoice
            </option>
            {list.filter((inv) => inv.status !== "paid").map((inv) => (
              <option key={inv.id} value={inv.id}>
                Invoice #{inv.id} - Amount {inv.amount}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Payment amount"
            value={selectedInvoice ? selectedInvoice.amount : paymentForm.amount}
            readOnly
            required
          />
          <input
            type="date"
            value={paymentForm.payment_date}
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
            required
          />
          <select
            value={paymentForm.payment_method}
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
            required
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Notes"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
          />
          <button type="submit">Submit payment</button>
          {!isCashierUser ? (
            <button
              type="button"
              onClick={() => generateControlNumber(Number(payingInvoiceId))}
              disabled={!payingInvoiceId || Boolean(selectedInvoice?.control_number)}
            >
              Generate Control Number
            </button>
          ) : null}
          <button
            type="button"
            className="danger"
            onClick={() => {
              setShowPaymentForm(false);
              setPayingInvoiceId(null);
              setPaymentForm({
                amount: "",
                payment_date: "",
                payment_method: "cash",
                notes: ""
              });
            }}
          >
            Cancel Payment
          </button>
        </form>
      ) : null}
      {paymentMessage ? <div className="ok-box">{paymentMessage}</div> : null}
      {paymentMessage && lastPaidInvoiceId && !isCashierUser ? (
        <div className="backup-actions">
          <button onClick={() => downloadInvoice(lastPaidInvoiceId)}>Download Invoice PDF</button>
        </div>
      ) : null}
    </section>
  );
}

function PaymentPanel({ refreshToken }) {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const totalTransactions = payments.length;
  const totalAmount = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2);

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const nonce = Date.now();
      const paymentData = await apiRequest(`/payments/?_=${nonce}`);
      setPayments(paymentData);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, [refreshToken]);

  async function downloadMonthlyReport() {
    try {
      const res = await apiFetch(`/payments/monthly_report/?month=${reportMonth}`);
      if (!res.ok) {
        throw new Error("Could not download monthly report.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${reportMonth}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="panel" id="payments-section">
      <SectionHeader title="Payment Recording" subtitle="All transaction history." />
      <div className="stats-strip stats-inline">
        <StatCard label="Total transactions" value={totalTransactions} trend="6.9%" trendUp />
        <StatCard label="Total amount" value={totalAmount} trend="11.8%" trendUp prefix="$" decimals={2} />
        <article className="stat-card">
          <span>Last refresh</span>
          <strong>{lastRefreshedAt || "-"}</strong>
          <em className="trend up">↑ live</em>
        </article>
      </div>
      <div className="toolbar-row">
        <button type="button" onClick={loadData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Transactions"}
        </button>
        <div className="grid-form report-form">
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
          />
          <button type="button" onClick={downloadMonthlyReport}>Download Monthly Transactions</button>
        </div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Invoice</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Method</th>
              <th>Customer UID</th>
              <th>Status after payment</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.invoice}</td>
                <td>{p.amount}</td>
                <td>{p.payment_date}</td>
                <td>{p.payment_method}</td>
                <td>{p.customer_uid}</td>
                <td>{p.invoice_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NormalUserInvoicePanel({ refreshToken }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const paidCount = list.filter((inv) => inv.status === "paid").length;
  const unpaidCount = list.length - paidCount;

  async function loadInvoices() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/invoices/");
      setList(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateControlNumber(invoiceId) {
    setError("");
    setMessage("");
    try {
      const data = await apiRequest(`/invoices/${invoiceId}/generate_control_number/`, {
        method: "POST"
      });
      setMessage(
        data.generated
          ? `Control number generated: ${data.control_number}`
          : `Control number already exists: ${data.control_number}`
      );
      await loadInvoices();
    } catch (e) {
      setError(e.message);
    }
  }

  async function downloadInvoice(id) {
    setError("");
    try {
      const res = await apiFetch(`/invoices/${id}/download/`);
      if (!res.ok) {
        throw new Error("Could not download invoice.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, [refreshToken]);

  return (
    <section className="panel" id="normal-user-invoices-section">
      <SectionHeader
        title="My Invoices"
        subtitle="View your paid and unpaid invoices."
      />
      <div className="stats-strip">
        <StatCard label="Total" value={list.length} trend="5.1%" trendUp />
        <StatCard label="Paid" value={paidCount} trend="2.7%" trendUp />
        <StatCard label="Unpaid" value={unpaidCount} trend="1.8%" trendUp={false} />
      </div>
      {loading ? <p>Loading invoices...</p> : null}
      {message ? <div className="ok-box">{message}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Amount</th>
              <th>Due date</th>
              <th>Status</th>
              <th>Control Number</th>
              <th>Paid</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.id}</td>
                <td>{inv.amount}</td>
                <td>{inv.due_date}</td>
                <td>
                  <span className={inv.status === "paid" ? "pill paid" : "pill unpaid"}>{inv.status}</span>
                </td>
                <td>{inv.control_number || "-"}</td>
                <td>{inv.total_paid}</td>
                <td>
                  <div className="actions-cell">
                    <button
                      type="button"
                      onClick={() => generateControlNumber(inv.id)}
                      disabled={inv.status === "paid" || Boolean(inv.control_number)}
                    >
                      Generate Control Number
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInvoice(inv.id)}
                      disabled={inv.status !== "paid"}
                    >
                      Download Invoice
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminBackupPanel({ roles, user, onRecovered }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [restoreFile, setRestoreFile] = useState(null);
  const [wipe, setWipe] = useState(false);

  const isAdmin = roles.includes("admin") || user?.is_superuser;
  if (!isAdmin) return null;

  async function downloadBackup() {
    setError("");
    setMessage("");
    try {
      const data = await apiRequest("/admin/backup/");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Backup downloaded.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function restoreFromFile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (!restoreFile) {
        throw new Error("Select a backup file first.");
      }
      const text = await restoreFile.text();
      const payload = JSON.parse(text);
      const res = await apiRequest("/admin/restore/", {
        method: "POST",
        body: JSON.stringify({ payload, wipe })
      });
      setMessage(`${res.detail} ${res.restored.invoices} invoices, ${res.restored.payments} payments.`);
      onRecovered();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="panel" id="backup-section">
      <SectionHeader title="Backup and Recovery" subtitle="Admin-only backup download and restore upload." />
      <div className="backup-actions">
        <button onClick={downloadBackup}>Download backup JSON</button>
      </div>
      <form onSubmit={restoreFromFile} className="restore-form">
        <label>
          Restore from backup file
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
          Wipe existing invoices and payments before restore
        </label>
        <button type="submit">Restore from file</button>
      </form>
      {message ? <div className="ok-box">{message}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
    </section>
  );
}

function SystemUsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/users/");
      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <section className="panel" id="system-users-section">
      <SectionHeader title="System Users" subtitle="All users currently registered in the system." />
      <div className="backup-actions">
        <button type="button" onClick={loadUsers}>Refresh Users</button>
      </div>
      {loading ? <p>Loading users...</p> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>UID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.uid || "-"}</td>
                <td>{u.username}</td>
                <td>{u.email || "-"}</td>
                <td>{u.roles?.length ? u.roles.join(", ") : "normal-user"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Dashboard({ user, onLogout }) {
  const roles = useMemo(() => user.roles || [], [user]);
  const showPaymentPanel = user.is_staff;
  const showAdminLayout = roles.includes("admin") || roles.includes("manager") || user?.is_superuser;
  const isCashierUser = roles.includes("cashier");
  const isNormalUser = !showAdminLayout && !isCashierUser;
  const isCashierDashboard = !showAdminLayout && isCashierUser;
  const isSuperAdmin = roles.includes("admin") || user?.is_superuser;
  const canRegisterCashier = showAdminLayout && (roles.includes("admin") || roles.includes("manager") || user?.is_superuser);
  const canViewUsers = roles.includes("admin") || user?.is_superuser;
  const showUidBadge = !showAdminLayout && !isCashierUser;
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSection, setActiveSection] = useState("invoices");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const handleRecovered = () => setRefreshToken((v) => v + 1);

  useEffect(() => {
    if (activeSection === "payments" && !showPaymentPanel) {
      setActiveSection("invoices");
      return;
    }
    if (activeSection === "backup" && !isSuperAdmin) {
      setActiveSection("invoices");
      return;
    }
    if (activeSection === "cashier-register" && !canRegisterCashier) {
      setActiveSection("invoices");
      return;
    }
    if (activeSection === "users" && !canViewUsers) {
      setActiveSection("invoices");
    }
  }, [activeSection, showPaymentPanel, isSuperAdmin, canRegisterCashier, canViewUsers]);

  return (
    <div className="system-page">
      <header className="system-header">
        <span className="system-title">Payment Management System</span>
      </header>
      <main className="system-main">
        <div className={showAdminLayout ? `app-shell with-sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}` : "app-shell"}>
          {showAdminLayout ? (
            <AdminOverviewPanel
              user={user}
              roles={roles}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              showPaymentPanel={showPaymentPanel}
              canRegisterCashier={canRegisterCashier}
              canViewUsers={canViewUsers}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((v) => !v)}
            />
          ) : null}
          <div className="app-main">
            <header className="top-bar">
              {showAdminLayout ? (
                <button
                  type="button"
                  className="sidebar-toggle mobile-only"
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  aria-label="Toggle sidebar"
                >
                  ☰
                </button>
              ) : null}
              <span className="top-brand">
                {showAdminLayout
                  ? "System Dashboard"
                  : isCashierDashboard
                    ? "Cashier Dashboard"
                    : "User Dashboard"}
              </span>
              <div className="top-bar-actions">
                <span className="user-badge">{user.username}</span>
                {roles.length > 0
                  ? roles.map((role) => <span key={role} className="role-pill">{role}</span>)
                  : <span className="role-pill">user</span>}
                {showUidBadge ? <span className="uid-badge">UID: {user.uid || "N/A"}</span> : null}
                <button onClick={onLogout}>Logout</button>
              </div>
            </header>
            {showAdminLayout ? (
              <div className="content-grid">
                {activeSection === "invoices" ? (
                  <InvoicePanel roles={roles} user={user} refreshToken={refreshToken} />
                ) : null}
                {activeSection === "payments" && showPaymentPanel ? (
                  <PaymentPanel refreshToken={refreshToken} />
                ) : null}
                {activeSection === "cashier-register" && canRegisterCashier ? (
                  <CashierRegistrationPanel />
                ) : null}
                {activeSection === "users" && canViewUsers ? (
                  <SystemUsersPanel />
                ) : null}
                {activeSection === "backup" ? (
                  <AdminBackupPanel roles={roles} user={user} onRecovered={handleRecovered} />
                ) : null}
              </div>
            ) : (
              <main className="content-grid">
                {isNormalUser ? (
                  <NormalUserInvoicePanel refreshToken={refreshToken} />
                ) : (
                  <InvoicePanel roles={roles} user={user} refreshToken={refreshToken} />
                )}
                {showPaymentPanel ? <PaymentPanel refreshToken={refreshToken} /> : null}
                <AdminBackupPanel roles={roles} user={user} onRecovered={handleRecovered} />
              </main>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [prefillUsername, setPrefillUsername] = useState("");

  useEffect(() => {
    async function bootstrap() {
      if (!hasSession()) {
        setLoading(false);
        return;
      }
      try {
        const me = await currentUser();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function onLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="system-page">
        <header className="system-header">
          <span className="system-title">Payment Management System</span>
        </header>
        <div className="auth-shell loading-state">
          <div className="loading-glass">
            <span className="spinner" />
            <p>Loading secure workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard user={user} onLogout={onLogout} />;
  }

  if (authView === "register") {
    return (
      <RegisterForm
        onSwitchToLogin={() => setAuthView("login")}
        onRegistered={(username) => {
          setPrefillUsername(username);
          setAuthView("login");
        }}
      />
    );
  }

  return (
    <LoginForm
      onLogin={setUser}
      initialUsername={prefillUsername}
      onSwitchToRegister={() => setAuthView("register")}
    />
  );
}

