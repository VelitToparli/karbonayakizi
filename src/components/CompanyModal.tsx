import { useState } from "react";
import type { Company } from "../types";

type CompanyFormData = Omit<Company, "id" | "createdAt">;

type CompanyModalProps = {
  company?: Company | null;
  onSave: (data: CompanyFormData) => Promise<void>;
  onClose: () => void;
};

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

export function CompanyModal(props: CompanyModalProps) {
  const [form, setForm] = useState<CompanyFormData>({
    name: props.company?.name ?? "",
    taxNumber: props.company?.taxNumber ?? "",
    sector: props.company?.sector ?? "",
    address: props.company?.address ?? "",
    contactEmail: props.company?.contactEmail ?? "",
    contactPhone: props.company?.contactPhone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof CompanyFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Firma adi zorunludur.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await props.onSave(form);
      props.onClose();
    } catch {
      setError("Kaydetme sirasinda hata olustu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">
            {props.company ? "Firma Bilgilerini Duzenle" : "Yeni Firma Ekle"}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={props.onClose}
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-fields">
            <label>
              Firma Adi *
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ornek: ABC Gida A.S."
                required
              />
            </label>

            <label>
              Vergi No
              <input
                type="text"
                value={form.taxNumber}
                onChange={(e) => set("taxNumber", e.target.value)}
                placeholder="1234567890"
              />
            </label>

            <label>
              Sektor
              <select
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
              >
                <option value="">Sektor secin...</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Iletisim E-posta
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                placeholder="info@firma.com"
              />
            </label>

            <label>
              Iletisim Telefon
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                placeholder="+90 212 000 00 00"
              />
            </label>

            <label className="modal-field-full">
              Adres
              <textarea
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Tam adres bilgisi"
                rows={3}
              />
            </label>
          </div>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={props.onClose}
              disabled={saving}
            >
              Iptal
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "Kaydediliyor..." : props.company ? "Guncelle" : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
