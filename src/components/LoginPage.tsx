import { useState } from "react";
import type { AuthUser } from "../context/AuthContext";
import { useAuth } from "../context/AuthContext";

type Props = {
  onSwitchToRegister: () => void;
};

export function LoginPage({ onSwitchToRegister }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { message: string; token?: string; user?: AuthUser };
      if (!res.ok) {
        setError(data.message);
        return;
      }
      login(data.token!, data.user!);
    } catch {
      setError("Sunucuya baglanılamadi. Sunucunun calısıp calısmadıgını kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🌱</span>
          <h1>Karbon Ayak İzi</h1>
          <p>Hesaplama ve Raporlama Platformu</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Giriş Yap</h2>

          <div className="auth-field">
            <label>E-posta</label>
            <input
              type="email"
              placeholder="ahmet@firma.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>Şifre</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="auth-switch">
          Hesabınız yok mu?{" "}
          <button type="button" onClick={onSwitchToRegister}>
            Kayıt Olun
          </button>
        </p>
      </div>
    </div>
  );
}
