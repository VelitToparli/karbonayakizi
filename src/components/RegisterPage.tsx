import { useState } from "react";
import type { AuthUser } from "../context/AuthContext";
import { useAuth } from "../context/AuthContext";

const SECTORS = [
  "Tarim ve Gida",
  "Tekstil ve Giyim",
  "Kimya ve Petrokimya",
  "Metal ve Celik",
  "Otomotiv",
  "Elektronik",
  "Insaat ve Yapi Malzemeleri",
  "Enerji",
  "Lojistik ve Tasimacilik",
  "Perakende",
  "Saglik",
  "Egitim",
  "Hizmet Sektoru",
  "Diger",
];

type Props = {
  onSwitchToLogin: () => void;
};

export function RegisterPage({ onSwitchToLogin }: Props) {
  const { login } = useAuth();
  const [step, setStep] = useState<"user" | "company">("user");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    companyName: "",
    sector: "",
    taxNumber: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleUserStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Ad soyad zorunludur.");
    if (!form.email.trim()) return setError("E-posta zorunludur.");
    if (form.password.length < 6) return setError("Sifre en az 6 karakter olmalidir.");
    if (form.password !== form.passwordConfirm) return setError("Sifreler uyusmuyor.");
    setStep("company");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.companyName.trim()) return setError("Firma adi zorunludur.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          companyName: form.companyName,
          sector: form.sector,
          taxNumber: form.taxNumber,
          address: form.address,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
        }),
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

        <div className="auth-steps">
          <span className={`auth-step ${step === "user" ? "active" : "done"}`}>1. Kullanıcı Bilgileri</span>
          <span className="auth-step-sep">→</span>
          <span className={`auth-step ${step === "company" ? "active" : ""}`}>2. Firma Bilgileri</span>
        </div>

        {step === "user" ? (
          <form className="auth-form" onSubmit={handleUserStep}>
            <h2>Hesap Oluştur</h2>

            <div className="auth-field">
              <label>Ad Soyad *</label>
              <input
                type="text"
                placeholder="Ahmet Yılmaz"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>E-posta *</label>
              <input
                type="email"
                placeholder="ahmet@firma.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <label>Şifre * (en az 6 karakter)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <label>Şifre Tekrar *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.passwordConfirm}
                onChange={(e) => set("passwordConfirm", e.target.value)}
                required
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-btn">
              Devam →
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2>Firma Bilgileri</h2>

            <div className="auth-field">
              <label>Firma Adı *</label>
              <input
                type="text"
                placeholder="ABC Gıda A.Ş."
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>Sektör</label>
              <select value={form.sector} onChange={(e) => set("sector", e.target.value)}>
                <option value="">Sektör seçin...</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="auth-field">
              <label>Vergi No</label>
              <input
                type="text"
                placeholder="1234567890"
                value={form.taxNumber}
                onChange={(e) => set("taxNumber", e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label>İletişim E-posta</label>
              <input
                type="email"
                placeholder="info@firma.com"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label>İletişim Telefon</label>
              <input
                type="tel"
                placeholder="+90 212 000 00 00"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label>Adres</label>
              <textarea
                placeholder="Tam adres bilgisi"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <div className="auth-form-actions">
              <button type="button" className="auth-btn-secondary" onClick={() => { setStep("user"); setError(""); }}>
                ← Geri
              </button>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Kaydediliyor..." : "Kaydı Tamamla"}
              </button>
            </div>
          </form>
        )}

        <p className="auth-switch">
          Zaten hesabınız var mı?{" "}
          <button type="button" onClick={onSwitchToLogin}>
            Giriş Yapın
          </button>
        </p>
      </div>
    </div>
  );
}
