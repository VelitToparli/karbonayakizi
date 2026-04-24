type SummaryCardsProps = {
  grandTotal: number;
  totalSteps: number;
  activeInputs: number;
};

export function SummaryCards(props: SummaryCardsProps) {
  return (
    <section className="summary" aria-live="polite">
      <article>
        <h2>Genel Toplam</h2>
        <p>
          <strong>{props.grandTotal.toFixed(2)}</strong> kgCO2e
        </p>
      </article>
      <article>
        <h2>Adim Sayisi</h2>
        <p>
          <strong>{props.totalSteps}</strong> kalem
        </p>
      </article>
      <article>
        <h2>Aktif Veri Girisi</h2>
        <p>
          <strong>{props.activeInputs}</strong> adim
        </p>
      </article>
    </section>
  );
}
