import type { RecordItem } from "../types";

type RecordsSectionProps = {
  records: RecordItem[];
};

export function RecordsSection(props: RecordsSectionProps) {
  return (
    <section className="records">
      <h2>Kayitli Son Hesaplamalar</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Sirket</th>
              <th>Donem</th>
              <th>Toplam (kgCO2e)</th>
            </tr>
          </thead>
          <tbody>
            {props.records.length === 0 ? (
              <tr>
                <td colSpan={4}>Kayit bulunmuyor.</td>
              </tr>
            ) : (
              props.records.map((record) => {
                const period =
                  record.periodType === "yearly"
                    ? String(record.year)
                    : `${record.year}-${String(record.month ?? 1).padStart(2, "0")}`;

                return (
                  <tr key={`${record.createdAt}-${record.companyName}`}>
                    <td>
                      {new Date(record.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td>{record.companyName}</td>
                    <td>{period}</td>
                    <td>{record.grandTotal.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
