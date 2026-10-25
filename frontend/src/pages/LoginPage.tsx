import { useState, type FormEvent } from "react";
import { 
  ShieldCheck, 
  Leaf, 
  LogIn, 
  UserPlus, 
  Building2, 
  HeartHandshake, 
  ClipboardCheck, 
  AlertCircle, 
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  CheckCircle2
} from "lucide-react";
import { authService, DEMO_USERS, type DemoUserOption } from "../services/authService";
import type { AuthUser, Role } from "../types";

export interface LoginPageProps {
  onLoginSuccess?: (user?: AuthUser) => void;
  onCancel?: () => void;
}

export function LoginPage({ onLoginSuccess, onCancel }: LoginPageProps) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Sign In state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<Role>("Donor");
  const [regOrg, setRegOrg] = useState("");

  async function handleLogin(e?: FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await authService.login({
        email: loginEmail,
        password: loginPassword,
      });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await authService.register({
        email: regEmail,
        password: regPassword,
        full_name: regName,
        role: regRole,
        organization: regOrg.trim() || undefined,
      });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemoLogin(demo: DemoUserOption) {
    setError("");
    setLoading(true);
    try {
      const user = await authService.login({
        email: demo.email,
        password: demo.password,
      });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Quick login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="brand" style={{ display: "inline-flex", marginBottom: "0.5rem" }}>
            <span className="brand-mark"><Leaf size={20} /></span>
            <span style={{ fontSize: "1.3rem" }}>fundtrace<span className="brand-period">.</span></span>
          </div>
          <h2>Authentication & Role-Based Access</h2>
          <p className="auth-subtitle">
            Securely sign in to access role-governed workflows for Donors, NGO Admins, and Independent Auditors.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button 
            type="button"
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => { setMode("signin"); setError(""); }}
          >
            <LogIn size={16} />
            <span>Sign In</span>
          </button>
          <button 
            type="button"
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(""); }}
          >
            <UserPlus size={16} />
            <span>Create Account</span>
          </button>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {mode === "signin" ? (
          <div>
            {/* Direct Login Form */}
            <form onSubmit={handleLogin} className="auth-form">
              <label className="field field-full">
                <span>Email Address</span>
                <div className="input-with-icon">
                  <Mail size={16} />
                  <input 
                    type="email" 
                    required 
                    placeholder="e.g. donor@aarav.org" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </label>

              <label className="field field-full">
                <span>Password</span>
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input 
                    type="password" 
                    required 
                    placeholder="Enter password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
              </label>

              <div className="auth-form-actions">
                <button 
                  type="submit" 
                  className="button button-primary field-full"
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Sign In to Workspace"}
                </button>
              </div>
            </form>

            {/* Quick Demo Login Personas */}
            <div className="auth-divider">
              <span>Or quick-login as a demo persona</span>
            </div>

            <div className="demo-accounts-grid">
              {DEMO_USERS.map((demo) => {
                const Icon = demo.role === "Donor" 
                  ? HeartHandshake 
                  : demo.role === "NGO admin" 
                    ? Building2 
                    : ClipboardCheck;

                return (
                  <button 
                    key={demo.email}
                    type="button"
                    className="demo-persona-card"
                    onClick={() => void handleQuickDemoLogin(demo)}
                    disabled={loading}
                  >
                    <div className="persona-card-top">
                      <div className="persona-avatar">
                        <Icon size={18} />
                      </div>
                      <div className="persona-meta">
                        <strong>{demo.name}</strong>
                        <span className="persona-role-badge">{demo.role}</span>
                      </div>
                      <ArrowRight size={16} className="persona-arrow" />
                    </div>
                    <p className="persona-desc">{demo.description}</p>
                    <small className="persona-cred">{demo.email}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} className="auth-form">
            <label className="field field-full">
              <span>Full Name</span>
              <div className="input-with-icon">
                <UserIcon size={16} />
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Aarav Mehta"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </div>
            </label>

            <label className="field field-full">
              <span>Email Address</span>
              <div className="input-with-icon">
                <Mail size={16} />
                <input 
                  type="email" 
                  required 
                  placeholder="name@organization.org"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="field field-full">
              <span>Password (min. 6 characters)</span>
              <div className="input-with-icon">
                <Lock size={16} />
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  placeholder="Create a secure password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
            </label>

            {/* Role Selection */}
            <div className="role-selection-group field-full">
              <span className="field-group-label">Select Account Role & Permissions</span>
              <div className="role-options-cards">
                <label className={`role-card ${regRole === "Donor" ? "selected" : ""}`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="Donor"
                    checked={regRole === "Donor"}
                    onChange={() => setRegRole("Donor")}
                  />
                  <div className="role-card-header">
                    <HeartHandshake size={18} />
                    <strong>Donor</strong>
                  </div>
                  <p>Contribute funds to projects, track transparent allocation, and inspect personal donation impact.</p>
                </label>

                <label className={`role-card ${regRole === "NGO admin" ? "selected" : ""}`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="NGO admin"
                    checked={regRole === "NGO admin"}
                    onChange={() => setRegRole("NGO admin")}
                  />
                  <div className="role-card-header">
                    <Building2 size={18} />
                    <strong>NGO Admin</strong>
                  </div>
                  <p>Create projects, manage spending budgets, and submit expense claims with SHA-256 receipt evidence.</p>
                </label>

                <label className={`role-card ${regRole === "Auditor" ? "selected" : ""}`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="Auditor"
                    checked={regRole === "Auditor"}
                    onChange={() => setRegRole("Auditor")}
                  />
                  <div className="role-card-header">
                    <ClipboardCheck size={18} />
                    <strong>Auditor</strong>
                  </div>
                  <p>Inspect claims, verify receipt hashes, approve/reject expenses, and monitor compliance audit trails.</p>
                </label>
              </div>
            </div>

            {regRole !== "Donor" && (
              <label className="field field-full">
                <span>Organization / Firm Name</span>
                <div className="input-with-icon">
                  <Building2 size={16} />
                  <input 
                    type="text" 
                    required 
                    placeholder={regRole === "NGO admin" ? "e.g. Helping Hands Foundation" : "e.g. TrustCheck Independent Audit"}
                    value={regOrg}
                    onChange={(e) => setRegOrg(e.target.value)}
                  />
                </div>
              </label>
            )}

            {/* Permission preview summary */}
            <div className="permission-summary-box field-full">
              <div className="summary-title">
                <ShieldCheck size={16} />
                <span>Granted capabilities for <strong>{regRole}</strong>:</span>
              </div>
              <ul className="summary-list">
                {regRole === "Donor" && (
                  <>
                    <li><CheckCircle2 size={14} className="text-green" /> Make contributions to active projects</li>
                    <li><CheckCircle2 size={14} className="text-green" /> View personal contribution history</li>
                    <li><CheckCircle2 size={14} className="text-green" /> View overall project transparency and impact</li>
                  </>
                )}
                {regRole === "NGO admin" && (
                  <>
                    <li><CheckCircle2 size={14} className="text-green" /> Create and publish new charitable projects</li>
                    <li><CheckCircle2 size={14} className="text-green" /> Submit expense claims with receipt fingerprints</li>
                    <li><CheckCircle2 size={14} className="text-green" /> Track all incoming donations and budget allocations</li>
                  </>
                )}
                {regRole === "Auditor" && (
                  <>
                    <li><CheckCircle2 size={14} className="text-green" /> Approve, reject, or request evidence on expenses</li>
                    <li><CheckCircle2 size={14} className="text-green" /> Verify SHA-256 cryptographic receipt hashes</li>
                    <li><CheckCircle2 size={14} className="text-green" /> Full immutable audit trail access</li>
                  </>
                )}
              </ul>
            </div>

            <div className="auth-form-actions">
              <button 
                type="submit" 
                className="button button-primary field-full"
                disabled={loading}
              >
                {loading ? "Creating Account..." : `Register as ${regRole}`}
              </button>
            </div>
          </form>
        )}

        {onCancel && (
          <div className="auth-footer-action">
            <button type="button" className="button button-plain" onClick={onCancel}>
              Continue as Guest / Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
