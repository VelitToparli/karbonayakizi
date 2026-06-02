import { useState } from "react";
import type { GroupTotal, RecordItem, StepDetail } from "../types";
import { useAuth } from "../context/AuthContext";

type DetailRecord = RecordItem & {
  groupTotals: GroupTotal[];
  stepDetails: StepDetail[];
};

type RecordsSectionProps = {
  records: RecordItem[];
};

export function RecordsSection(props: RecordsSectionProps) {
  const { authFetch } = useAuth();
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleViewDetail = async (record: RecordItem) => {
    if (!record.id) return;
    setLoadingId(record.id);
    try {
      const res = await authFetch(`/api/records/${record.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as DetailRecord;
      setDetail(data);
    } catch {
      // ignore
    } finally {
      setLoadingId(null);
    }
  };

  const period = (r: RecordItem) =>
    r.periodType === "yearly"
      ? String(r.year)
      : `${r.year}-${String(r.month ?? 1).padStart(2, "0")}`;

  return (
    <section className="records">
      <div className="records-header">
        <h2>Kayitli Hesaplamalar</h2>
        <span className="records-count">{props.records.length} kayit</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Sirket</th>
              <th>Donem</th>
              <th>Toplam (kgCO2e)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {props.records.length === 0 ? (
              <tr>
                <td colSpan={5}>Kayit bulunmuyor.</td>
              </tr>
            ) : (
              props.records.map((record) => (
                <tr key={record.id ?? `${record.createdAt}-${record.companyName}`}>
                  <td>
                    {new Date(record.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td>{record.companyName}</td>
                  <td>{period(record)}</td>
                  <td>{Number(record.grandTotal).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="detail-btn"
                      onClick={() => handleViewDetail(record)}
                      disabled={loadingId === record.id}
                      title="Detaylari goster"
                    >
                      {loadingId === record.id ? "..." : "Detay"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div
          className="modal-overlay"
          onClick={() => setDetail(null)}
        >
          <div
            className="modal-box modal-box-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="detail-title">{detail.companyName}</h2>
                <p className="modal-subtitle">
                  {period(detail)} &nbsp;|&nbsp;{" "}
                  {new Date(detail.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetail(null)}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="detail-grand">
              Toplam Emisyon:{" "}
              <strong>{Number(detail.grandTotal).toFixed(2)} kgCO2e</strong>
              <span className="detail-grand-t">
                &nbsp;= {(Number(detail.grandTotal) / 1000).toFixed(4)} tCO2e
              </span>
            </div>

            <h3 className="detail-section-title">Grup Bazinda Dagilim</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Grup</th>
                    <th>Emisyon (kgCO2e)</th>
                    <th>Oran (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.groupTotals ?? []).map((g) => (
                    <tr key={g.groupId}>
                      <td>{g.groupTitle}</td>
                      <td>{Number(g.total).toFixed(2)}</td>
                      <td>
                        {detail.grandTotal > 0
                          ? ((g.total / detail.grandTotal) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="detail-section-title">Adim Detaylari (Emisyon &gt; 0)</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Adim</th>
                    <th>Grup</th>
                    <th>Birim</th>
                    <th>Miktar</th>
                    <th>Katsayi</th>
                    <th>Emisyon (kgCO2e)</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.stepDetails ?? [])
                    .filter((s) => s.emission > 0)
                    .sort((a, b) => b.emission - a.emission)
                    .map((s) => (
                      <tr key={s.stepId}>
                        <td>{s.stepLabel}</td>
                        <td>{s.groupTitle}</td>
                        <td>{s.unit}</td>
                        <td>{Number(s.value).toFixed(2)}</td>
                        <td>{Number(s.factor).toFixed(4)}</td>
                        <td>{Number(s.emission).toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

