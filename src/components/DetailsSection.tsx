import { Chart, registerables } from "chart.js";
import { useEffect, useRef } from "react";
import type { StepDetail } from "../types";

Chart.register(...registerables);

type DetailsSectionProps = {
  groupBreakdown: Array<{ title: string; total: number }>;
  topSteps: StepDetail[];
  generalTotal: number;
  activeInputs: number;
  totalSteps: number;
  topThreeShare: number;
  highestSourceLabel: string;
  highestSourceValue: number;
  reductionPotential: number;
  recommendations: string[];
};

export function DetailsSection(props: DetailsSectionProps) {
  const impactCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const impactChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!impactCanvasRef.current) {
      return;
    }

    const topImpactSteps = props.topSteps
      .filter((step) => step.emission > 0)
      .slice(0, 6);

    impactChartRef.current?.destroy();

    impactChartRef.current = new Chart(impactCanvasRef.current, {
      type: "bar",
      data: {
        labels: topImpactSteps.map((step) => step.stepLabel),
        datasets: [
          {
            label: "Mevcut Etki (kgCO2e)",
            data: topImpactSteps.map((step) =>
              Number(step.emission.toFixed(2)),
            ),
            backgroundColor: "rgba(211, 123, 0, 0.72)",
            borderRadius: 8,
          },
          {
            label: "Iyilestirme Potansiyeli (yaklasik %15)",
            data: topImpactSteps.map((step) =>
              Number((step.emission * 0.15).toFixed(2)),
            ),
            backgroundColor: "rgba(15, 139, 111, 0.72)",
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
        },
      },
    });

    return () => {
      impactChartRef.current?.destroy();
    };
  }, [props.topSteps]);

  return (
    <section className="details">
      <article>
        <h2>Detayli Sonuc Sayfasi</h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <span>Genel Toplam</span>
            <strong>{props.generalTotal.toFixed(2)} kgCO2e</strong>
          </div>
          <div className="kpi-card">
            <span>En Yuksek Etki Kaynagi</span>
            <strong>{props.highestSourceLabel}</strong>
            <small>{props.highestSourceValue.toFixed(2)} kgCO2e</small>
          </div>
          <div className="kpi-card">
            <span>Top 3 Katki Orani</span>
            <strong>%{props.topThreeShare.toFixed(1)}</strong>
          </div>
          <div className="kpi-card">
            <span>Aktif Adim / Toplam</span>
            <strong>
              {props.activeInputs} / {props.totalSteps}
            </strong>
          </div>
          <div className="kpi-card">
            <span>Onerilen Azaltim Potansiyeli</span>
            <strong>{props.reductionPotential.toFixed(2)} kgCO2e</strong>
          </div>
        </div>
        <div>
          {props.groupBreakdown.map((item) => (
            <div className="breakdown-row" key={item.title}>
              <span>{item.title}</span>
              <strong>{item.total.toFixed(2)} kgCO2e</strong>
            </div>
          ))}
        </div>
      </article>
      <article>
        <h2>En Yuksek Etkili Adimlar</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Adim</th>
                <th>Grup</th>
                <th>Emisyon (kgCO2e)</th>
              </tr>
            </thead>
            <tbody>
              {props.topSteps.map((item) => (
                <tr key={item.stepId}>
                  <td>{item.stepLabel}</td>
                  <td>{item.groupTitle}</td>
                  <td>{item.emission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <article className="detail-wide">
        <h2>Etki ve Iyilestirme Oneri Grafigi</h2>
        <div className="impact-chart-wrap">
          <canvas ref={impactCanvasRef} />
        </div>
        <ul className="recommendation-list">
          {props.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
