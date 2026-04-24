import { Chart, registerables } from "chart.js";
import { useEffect, useRef } from "react";
import type { AnalyticsData } from "../types";

Chart.register(...registerables);

type ChartsSectionProps = {
  year: number;
  analytics: AnalyticsData;
};

export function ChartsSection(props: ChartsSectionProps) {
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const yearlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyChartRef = useRef<Chart | null>(null);
  const yearlyChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!monthlyCanvasRef.current || !yearlyCanvasRef.current) {
      return;
    }

    monthlyChartRef.current?.destroy();
    yearlyChartRef.current?.destroy();

    monthlyChartRef.current = new Chart(monthlyCanvasRef.current, {
      type: "line",
      data: {
        labels: props.analytics.monthlyTotals.map((item) => `${item.month}.Ay`),
        datasets: [
          {
            label: `${props.year} Aylik Toplam`,
            data: props.analytics.monthlyTotals.map((item) =>
              Number(item.total.toFixed(2)),
            ),
            borderColor: "#0f8b6f",
            backgroundColor: "rgba(15, 139, 111, 0.2)",
            fill: true,
            tension: 0.35,
          },
        ],
      },
    });

    yearlyChartRef.current = new Chart(yearlyCanvasRef.current, {
      type: "bar",
      data: {
        labels: props.analytics.yearlyTotals.map((item) => String(item.year)),
        datasets: [
          {
            label: "Yillik Toplam kgCO2e",
            data: props.analytics.yearlyTotals.map((item) =>
              Number(item.total.toFixed(2)),
            ),
            backgroundColor: "rgba(211, 123, 0, 0.7)",
          },
        ],
      },
    });

    return () => {
      monthlyChartRef.current?.destroy();
      yearlyChartRef.current?.destroy();
    };
  }, [props.analytics, props.year]);

  return (
    <section className="charts">
      <article>
        <h2>Aylik Karsilastirma (Secilen Yil)</h2>
        <canvas ref={monthlyCanvasRef} height={120} />
      </article>
      <article>
        <h2>Yillik Karsilastirma</h2>
        <canvas ref={yearlyCanvasRef} height={120} />
      </article>
    </section>
  );
}
