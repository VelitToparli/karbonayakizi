import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Controls } from "./components/Controls";
import { DetailsSection } from "./components/DetailsSection";
import { GroupList } from "./components/GroupList";
import { RecordsSection } from "./components/RecordsSection";
import { SummaryCards } from "./components/SummaryCards";
import { ChartsSection } from "./components/ChartsSection";
import { defaultGroups } from "./data";
import type {
  AnalyticsData,
  CalculationResult,
  GroupTemplate,
  PeriodType,
  RecordItem,
  StepDetail,
} from "./types";

const initialYear = new Date().getFullYear();
const emptyAnalytics: AnalyticsData = {
  monthlyTotals: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    total: 0,
  })),
  yearlyTotals: [],
};

const toNumber = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

function calculateResult(
  groups: GroupTemplate[],
  values: Record<string, number>,
  factors: Record<string, number>,
): CalculationResult {
  let grandTotal = 0;
  let totalSteps = 0;
  let activeInputs = 0;
  const groupTotals: CalculationResult["groupTotals"] = [];
  const stepDetails: StepDetail[] = [];

  for (const group of groups) {
    let groupTotal = 0;

    for (const step of group.steps) {
      totalSteps += 1;
      const value = toNumber(values[step.id] ?? 0);
      const factor = toNumber(factors[step.id] ?? step.factor);
      const emission = value * factor;

      if (value > 0) {
        activeInputs += 1;
      }

      groupTotal += emission;
      stepDetails.push({
        stepId: step.id,
        stepLabel: step.label,
        unit: step.unit,
        groupTitle: group.title,
        value,
        factor,
        emission,
      });
    }

    grandTotal += groupTotal;
    groupTotals.push({
      groupId: group.id,
      groupTitle: group.title,
      total: groupTotal,
    });
  }

  return { grandTotal, totalSteps, activeInputs, groupTotals, stepDetails };
}

function getStepRecommendation(stepLabel: string): string {
  const label = stepLabel.toLowerCase();

  if (
    label.includes("elektrik") ||
    label.includes("kwh") ||
    label.includes("depo")
  ) {
    return `${stepLabel}: Enerji verimliligi calismalari ve yenilenebilir elektrik tedarigi onceliklendirilebilir.`;
  }
  if (
    label.includes("hava") ||
    label.includes("karayol") ||
    label.includes("denizyol") ||
    label.includes("tasima")
  ) {
    return `${stepLabel}: Rota optimizasyonu, yuk birlestirme ve dusuk emisyonlu tasima alternatifleri degerlendirilebilir.`;
  }
  if (label.includes("atik") || label.includes("geri donus")) {
    return `${stepLabel}: Atik azaltimi, geri kazanim ve kaynaga dayali ayrisma surecleri iyilestirilebilir.`;
  }
  return `${stepLabel}: Surec olcum kalitesi artirilip operasyonel verimlilik adimlariyla emisyon azaltimi planlanabilir.`;
}

export function App() {
  const wizardStepCount = defaultGroups.length;
  const [companyName, setCompanyName] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(initialYear);
  const [statusMessage, setStatusMessage] = useState("Hazir.");
  const [currentWizardStep, setCurrentWizardStep] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({});
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>(emptyAnalytics);

  const isResultStep = currentWizardStep >= wizardStepCount;
  const activeGroup =
    defaultGroups[Math.min(currentWizardStep, wizardStepCount - 1)];

  const result = useMemo(
    () => calculateResult(defaultGroups, values, factors),
    [values, factors],
  );

  const stepResults = useMemo(() => {
    const entries = result.stepDetails.map((detail) => [
      detail.stepId,
      detail.emission,
    ]);
    return Object.fromEntries(entries);
  }, [result.stepDetails]);

  const groupTotals = useMemo(() => {
    const entries = result.groupTotals.map((item) => [
      item.groupId,
      item.total,
    ]);
    return Object.fromEntries(entries);
  }, [result.groupTotals]);

  const topSteps = useMemo(
    () =>
      [...result.stepDetails]
        .sort((a, b) => b.emission - a.emission)
        .slice(0, 8),
    [result.stepDetails],
  );

  const keyInsights = useMemo(() => {
    const highestStep = topSteps[0];
    const topThreeTotal = topSteps
      .slice(0, 3)
      .reduce((sum, step) => sum + step.emission, 0);
    const topThreeShare =
      result.grandTotal > 0 ? (topThreeTotal / result.grandTotal) * 100 : 0;
    const reductionPotential = topSteps
      .slice(0, 5)
      .reduce((sum, step) => sum + step.emission * 0.15, 0);

    return {
      highestSourceLabel: highestStep ? highestStep.stepLabel : "Veri yok",
      highestSourceValue: highestStep ? highestStep.emission : 0,
      topThreeShare,
      reductionPotential,
      recommendations: topSteps
        .slice(0, 3)
        .map((step) => getStepRecommendation(step.stepLabel)),
    };
  }, [result.grandTotal, topSteps]);

  const getPeriodLabel = () =>
    periodType === "yearly"
      ? `${year}`
      : `${year}-${String(month).padStart(2, "0")}`;

  const loadFactorsFromStaticFiles = async () => {
    try {
      const response = await fetch("/factors.json");
      if (!response.ok) {
        throw new Error("JSON bulunamadi");
      }

      const data = (await response.json()) as {
        factors?: Record<string, number>;
      };
      if (data.factors) {
        setFactors((prev) => ({ ...prev, ...data.factors }));
        setStatusMessage(
          "Katsayilar sabit JSON dosyasindan otomatik yuklendi.",
        );
      }
      return;
    } catch (_error) {
      // Continue with Excel fallback.
    }

    try {
      const xlsxResponse = await fetch("/factors.xlsx");
      if (!xlsxResponse.ok) {
        throw new Error("Excel bulunamadi");
      }

      const workbook = XLSX.read(await xlsxResponse.arrayBuffer());
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const rows =
        XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
      const loadedFactors: Record<string, number> = {};

      for (const row of rows) {
        const stepId = String(row.stepId ?? "").trim();
        const factorValue = Number(row.factor);
        if (stepId && Number.isFinite(factorValue) && factorValue > 0) {
          loadedFactors[stepId] = factorValue;
        }
      }

      setFactors((prev) => ({ ...prev, ...loadedFactors }));
      setStatusMessage("Katsayilar Excel dosyasindan otomatik yuklendi.");
    } catch (_error) {
      setStatusMessage(
        "Sabit katsayi dosyasi bulunamadi. Varsayilan katsayilar kullaniliyor.",
      );
    }
  };

  const loadRecentRecords = async () => {
    try {
      const response = await fetch("/api/records");
      if (!response.ok) {
        throw new Error("Kayitlar getirilemedi");
      }

      const data = (await response.json()) as { records: RecordItem[] };
      setRecords(data.records.slice(0, 8));
    } catch (_error) {
      setRecords([]);
    }
  };

  const loadAnalytics = async (selectedYear: number) => {
    try {
      const response = await fetch(`/api/analytics?year=${selectedYear}`);
      if (!response.ok) {
        throw new Error("Analitik alinamadi");
      }

      const data = (await response.json()) as AnalyticsData;
      setAnalytics(data);
    } catch (_error) {
      setAnalytics(emptyAnalytics);
      setStatusMessage("Grafikler backend verisi olmadan gosterilemiyor.");
    }
  };

  const saveRecord = async () => {
    if (!companyName.trim()) {
      setStatusMessage("Kayit icin sirket/tesis alani zorunludur.");
      return;
    }

    const payload = {
      companyName: companyName.trim(),
      periodType,
      month: periodType === "monthly" ? month : null,
      year,
      grandTotal: result.grandTotal,
      groupTotals: result.groupTotals,
      stepDetails: result.stepDetails,
    };

    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Kayit basarisiz");
      }

      setStatusMessage("Hesaplama backend uzerine kaydedildi.");
      await Promise.all([loadAnalytics(year), loadRecentRecords()]);
    } catch (_error) {
      setStatusMessage(
        "Kayit yapilamadi. Backend servisinin acik oldugunu kontrol edin.",
      );
    }
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString("tr-TR");

    // ── SHEET 1: YÖNETİCİ ÖZETİ ──
    const summaryRows: (string | number)[][] = [
      ["KURUMSAL KARBON AYAK IZI - YONETICI OZET RAPORU"],
      [],
      ["Sirket / Tesis", companyName || "Belirtilmedi"],
      ["Donem", getPeriodLabel()],
      ["Rapor Tarihi", today],
      [],
      ["TEMEL METRIKLER", "", ""],
      ["Toplam Emisyon (kgCO2e)", Number(result.grandTotal.toFixed(2))],
      ["Toplam Emisyon (tCO2e)", Number((result.grandTotal / 1000).toFixed(4))],
      ["En Yuksek Kaynak", keyInsights.highestSourceLabel],
      [
        "En Yuksek Kaynak Emisyonu (kgCO2e)",
        Number(keyInsights.highestSourceValue.toFixed(2)),
      ],
      ["Top-3 Katki Orani (%)", Number(keyInsights.topThreeShare.toFixed(1))],
      [
        "Azaltim Potansiyeli (kgCO2e)",
        Number(keyInsights.reductionPotential.toFixed(2)),
      ],
      ["Aktif Adim Sayisi", result.activeInputs],
      ["Toplam Adim Sayisi", result.totalSteps],
      [],
      ["GRUP BAZINDA DAGILIM", "", ""],
      ["Grup", "Toplam (kgCO2e)", "Oran (%)"],
      ...result.groupTotals.map((g) => [
        g.groupTitle,
        Number(g.total.toFixed(2)),
        result.grandTotal > 0
          ? Number(((g.total / result.grandTotal) * 100).toFixed(1))
          : 0,
      ]),
      [],
      ["IYILESTIRME ONERILERI"],
      ...keyInsights.recommendations.map((rec, i) => [`${i + 1}. ${rec}`]),
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 48 }, { wch: 32 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Yonetici Ozeti");

    // ── SHEET 2: GRUP ANALİZİ ──
    const groupRows: (string | number)[][] = [
      ["GRUP BAZINDA EMISYON ANALIZI"],
      [],
      ["Sirket", companyName || "Belirtilmedi", "Donem", getPeriodLabel()],
      [],
      [
        "Grup",
        "Toplam Emisyon (kgCO2e)",
        "Toplam Emisyon (tCO2e)",
        "Oran (%)",
        "Azaltim Potansiyeli (kgCO2e)",
      ],
      ...result.groupTotals.map((g) => [
        g.groupTitle,
        Number(g.total.toFixed(2)),
        Number((g.total / 1000).toFixed(4)),
        result.grandTotal > 0
          ? Number(((g.total / result.grandTotal) * 100).toFixed(1))
          : 0,
        Number((g.total * 0.15).toFixed(2)),
      ]),
      [],
      [
        "TOPLAM",
        Number(result.grandTotal.toFixed(2)),
        Number((result.grandTotal / 1000).toFixed(4)),
        100,
        Number((result.grandTotal * 0.15).toFixed(2)),
      ],
    ];
    const groupSheet = XLSX.utils.aoa_to_sheet(groupRows);
    groupSheet["!cols"] = [
      { wch: 40 },
      { wch: 24 },
      { wch: 22 },
      { wch: 12 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, groupSheet, "Grup Analizi");

    // ── SHEET 3: ADIM DETAYLARI (emission desc order) ──
    const sortedDetails = [...result.stepDetails].sort(
      (a, b) => b.emission - a.emission,
    );
    const detailRows: (string | number)[][] = [
      ["TUM EMISYON KAYNAKLARI - ADIM BAZINDA DETAY"],
      [],
      ["Sirket", companyName || "Belirtilmedi", "Donem", getPeriodLabel()],
      [],
      [
        "Sira",
        "Emisyon Kaynagi (Adim)",
        "Grup",
        "Birim",
        "Miktar",
        "Katsayi (kgCO2e/birim)",
        "Emisyon (kgCO2e)",
        "Toplam Oran (%)",
      ],
      ...sortedDetails
        .filter((s) => s.emission > 0)
        .map((item, i) => [
          i + 1,
          item.stepLabel,
          item.groupTitle,
          item.unit,
          Number(item.value.toFixed(2)),
          Number(item.factor.toFixed(4)),
          Number(item.emission.toFixed(2)),
          result.grandTotal > 0
            ? Number(((item.emission / result.grandTotal) * 100).toFixed(1))
            : 0,
        ]),
      [],
      ["", "TOPLAM", "", "", "", "", Number(result.grandTotal.toFixed(2)), 100],
    ];
    const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
    detailSheet["!cols"] = [
      { wch: 6 },
      { wch: 44 },
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Adim Detaylari");

    // ── SHEET 4: GRAFİK VERİSİ (for manual chart creation) ──
    const chartRows: (string | number)[][] = [
      ["GRAFIK VERISI - En Yuksek 8 Emisyon Kaynagi"],
      [],
      [
        "Emisyon Kaynagi",
        "Mevcut Etki (kgCO2e)",
        "Iyilestirme Potansiyeli (kgCO2e)",
        "Kalan Emisyon (kgCO2e)",
      ],
      ...topSteps
        .filter((s) => s.emission > 0)
        .slice(0, 8)
        .map((s) => [
          s.stepLabel,
          Number(s.emission.toFixed(2)),
          Number((s.emission * 0.15).toFixed(2)),
          Number((s.emission * 0.85).toFixed(2)),
        ]),
    ];
    const chartSheet = XLSX.utils.aoa_to_sheet(chartRows);
    chartSheet["!cols"] = [{ wch: 44 }, { wch: 24 }, { wch: 32 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(workbook, chartSheet, "Grafik Verisi");

    XLSX.writeFile(workbook, `karbon-yonetici-raporu-${getPeriodLabel()}.xlsx`);
    setStatusMessage("Yonetici Excel raporu indirildi.");
  };

  const exportToPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mg = 40;
    const cw = pageW - mg * 2;
    const today = new Date().toLocaleDateString("tr-TR");

    // Helper: draw a horizontal bar chart with jsPDF primitives
    const drawHBars = (
      x: number,
      startY: number,
      areaW: number,
      labels: string[],
      values: number[],
      color: [number, number, number],
      rowH = 26,
    ) => {
      const maxVal = Math.max(...values, 1);
      const labelColW = 175;
      const barAreaW = areaW - labelColW - 55;
      labels.forEach((label, i) => {
        const by = startY + i * rowH;
        doc.setFontSize(7.5);
        doc.setTextColor(55, 55, 55);
        const truncated = doc.splitTextToSize(
          label,
          labelColW - 6,
        )[0] as string;
        doc.text(truncated, x, by + rowH - 7);
        doc.setFillColor(225, 225, 225);
        doc.rect(x + labelColW, by + 4, barAreaW, rowH - 10, "F");
        const bw = (values[i] / maxVal) * barAreaW;
        doc.setFillColor(...color);
        doc.rect(x + labelColW, by + 4, bw, rowH - 10, "F");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(
          `${values[i].toFixed(1)}`,
          x + labelColW + bw + 4,
          by + rowH - 7,
        );
      });
    };

    // ─────────────────────────────────────────────────
    // PAGE 1 — KAPAK + YÖNETİCİ ÖZETİ
    // ─────────────────────────────────────────────────
    doc.setFillColor(16, 59, 45);
    doc.rect(0, 0, pageW, 165, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("KURUMSAL KARBON AYAK IZI", mg, 58);
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text("Yonetici Ozet Raporu", mg, 80);

    doc.setFontSize(9.5);
    doc.text(`Sirket / Tesis : ${companyName || "Belirtilmedi"}`, mg, 108);
    doc.text(`Donem          : ${getPeriodLabel()}`, mg, 124);
    doc.text(`Rapor Tarihi   : ${today}`, mg, 140);

    // Grand total callout box
    doc.setFillColor(245, 250, 247);
    doc.setDrawColor(15, 139, 111);
    doc.setLineWidth(2);
    doc.rect(mg, 178, cw, 72, "FD");
    doc.setLineWidth(1);

    doc.setTextColor(16, 59, 45);
    doc.setFontSize(30);
    doc.setFont("helvetica", "bold");
    doc.text(`${result.grandTotal.toFixed(2)} kgCO2e`, mg + 14, 224);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(
      `= ${(result.grandTotal / 1000).toFixed(4)} tCO2e  —  Toplam Karbon Emisyonu`,
      mg + 14,
      242,
    );

    // KPI mini boxes (4 cards across)
    const kpis = [
      {
        label: "En Yuksek Kaynak",
        value: keyInsights.highestSourceLabel,
      },
      {
        label: "Top-3 Katki Orani",
        value: `%${keyInsights.topThreeShare.toFixed(1)}`,
      },
      {
        label: "Azaltim Potansiyeli",
        value: `${keyInsights.reductionPotential.toFixed(2)} kg`,
      },
      {
        label: "Aktif / Toplam Adim",
        value: `${result.activeInputs} / ${result.totalSteps}`,
      },
    ];
    const kpiW = cw / kpis.length;
    kpis.forEach((kpi, i) => {
      const kx = mg + i * kpiW;
      doc.setFillColor(i % 2 === 0 ? 238 : 248, 248, 244);
      doc.setDrawColor(200, 210, 205);
      doc.rect(kx, 264, kpiW, 58, "FD");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label, kx + 7, 280);
      doc.setTextColor(16, 59, 45);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const valText = doc.splitTextToSize(kpi.value, kpiW - 10)[0] as string;
      doc.text(valText, kx + 7, 300);
      doc.setFont("helvetica", "normal");
    });

    // Group breakdown section heading
    let cy = 345;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Grup Bazinda Emisyon Dagilimi", mg, cy);
    cy += 14;

    // Group bar chart
    const groupLabels = result.groupTotals.map((g) => g.groupTitle);
    const groupValues = result.groupTotals.map((g) => g.total);
    drawHBars(mg, cy, cw, groupLabels, groupValues, [15, 140, 111], 32);
    cy += result.groupTotals.length * 32 + 14;

    // Group summary table
    autoTable(doc, {
      startY: cy,
      head: [["Grup", "Toplam (kgCO2e)", "Toplam (tCO2e)", "Oran (%)"]],
      body: result.groupTotals.map((item) => [
        item.groupTitle,
        item.total.toFixed(2),
        (item.total / 1000).toFixed(4),
        result.grandTotal > 0
          ? `%${((item.total / result.grandTotal) * 100).toFixed(1)}`
          : "0%",
      ]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [16, 59, 45], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 248, 244] },
      footStyles: { fillColor: [230, 240, 235], fontStyle: "bold" },
      foot: [
        [
          "TOPLAM",
          result.grandTotal.toFixed(2),
          (result.grandTotal / 1000).toFixed(4),
          "100%",
        ],
      ],
      showFoot: "lastPage",
    });

    // ─────────────────────────────────────────────────
    // PAGE 2 — EN YÜKSEK ETKİLİ KAYNAKLAR + CHART
    // ─────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(16, 59, 45);
    doc.rect(0, 0, pageW, 52, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("En Yuksek Etkili Emisyon Kaynaklari", mg, 32);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${companyName || ""}  |  ${getPeriodLabel()}`, pageW - mg, 32, {
      align: "right",
    });

    cy = 74;
    const topEmitters = topSteps.filter((s) => s.emission > 0).slice(0, 8);

    // Dual bar chart: current impact vs improvement
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Mevcut Etki vs Iyilestirme Potansiyeli (kgCO2e)", mg, cy);
    cy += 14;

    if (topEmitters.length > 0) {
      const maxVal = Math.max(...topEmitters.map((s) => s.emission), 1);
      const labelColW = 168;
      const barAreaW = cw - labelColW - 58;
      const rowH = 30;
      const barH = 11;

      topEmitters.forEach((step, i) => {
        const by = cy + i * rowH;
        doc.setFontSize(7.5);
        doc.setTextColor(55, 55, 55);
        const label = doc.splitTextToSize(
          step.stepLabel,
          labelColW - 5,
        )[0] as string;
        doc.text(label, mg, by + barH + 2);

        // Emission bar (orange)
        doc.setFillColor(211, 123, 0);
        const bw1 = (step.emission / maxVal) * barAreaW;
        doc.rect(mg + labelColW, by, bw1, barH, "F");

        // Improvement bar (green, stacked below)
        doc.setFillColor(15, 139, 111);
        const bw2 = ((step.emission * 0.15) / maxVal) * barAreaW;
        doc.rect(mg + labelColW, by + barH + 2, bw2, barH - 2, "F");

        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(
          `${step.emission.toFixed(1)}`,
          mg + labelColW + bw1 + 3,
          by + barH,
        );
      });

      cy += topEmitters.length * rowH + 16;

      // Legend
      doc.setFillColor(211, 123, 0);
      doc.rect(mg, cy, 11, 8, "F");
      doc.setFontSize(8);
      doc.setTextColor(55, 55, 55);
      doc.text("Mevcut Etki", mg + 15, cy + 7);
      doc.setFillColor(15, 139, 111);
      doc.rect(mg + 100, cy, 11, 8, "F");
      doc.text("Iyilestirme Potansiyeli (~%15)", mg + 115, cy + 7);
      cy += 22;
    }

    // Top emitters table
    autoTable(doc, {
      startY: cy,
      head: [
        ["#", "Emisyon Kaynagi", "Grup", "Emisyon (kgCO2e)", "Toplam Orani"],
      ],
      body: topEmitters.map((item, idx) => [
        `#${idx + 1}`,
        item.stepLabel,
        item.groupTitle,
        item.emission.toFixed(2),
        result.grandTotal > 0
          ? `%${((item.emission / result.grandTotal) * 100).toFixed(1)}`
          : "0%",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 59, 45], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 248, 244] },
      columnStyles: {
        0: { cellWidth: 28, halign: "center" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    // ─────────────────────────────────────────────────
    // PAGE 3 — İYİLEŞTİRME ÖNERİLERİ
    // ─────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(16, 59, 45);
    doc.rect(0, 0, pageW, 52, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Iyilestirme Onerileri ve Eylem Plani", mg, 32);

    cy = 74;

    // Savings callout
    doc.setFillColor(240, 250, 245);
    doc.setDrawColor(15, 139, 111);
    doc.setLineWidth(2.5);
    doc.rect(mg, cy, cw, 56, "FD");
    doc.setLineWidth(1);
    doc.setTextColor(16, 59, 45);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Tahmini Azaltim Potansiyeli: ${keyInsights.reductionPotential.toFixed(2)} kgCO2e`,
      mg + 14,
      cy + 24,
    );
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(
      "En yuksek etkili ilk 5 kaynakta %15 iyilestirme yapilmasi durumunda elde edilebilecek tahmini azaltim.",
      mg + 14,
      cy + 42,
    );
    cy += 72;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Oncelikli Iyilestirme Alanlari", mg, cy);
    cy += 18;

    keyInsights.recommendations.forEach((rec, i) => {
      doc.setFillColor(16, 59, 45);
      doc.rect(mg, cy, 18, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}`, mg + (i < 9 ? 6 : 3), cy + 13);

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(rec, cw - 32) as string[];
      doc.text(lines, mg + 26, cy + 13);
      cy += Math.max(lines.length * 13, 24) + 10;

      if (cy > pageH - 80) {
        doc.addPage();
        cy = 60;
      }
    });

    // Improvement opportunity table
    cy += 8;
    const topFive = topSteps.filter((s) => s.emission > 0).slice(0, 5);
    if (topFive.length > 0 && cy < pageH - 120) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Iyilestirme Oncelik Matrisi (Top-5)", mg, cy);
      cy += 8;
      autoTable(doc, {
        startY: cy,
        head: [
          [
            "Emisyon Kaynagi",
            "Mevcut Etki (kgCO2e)",
            "Hedef Azaltim (%15)",
            "Hedef Sonrasi (kgCO2e)",
          ],
        ],
        body: topFive.map((item) => [
          item.stepLabel,
          item.emission.toFixed(2),
          (item.emission * 0.15).toFixed(2),
          (item.emission * 0.85).toFixed(2),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 59, 45], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 248, 244] },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
        },
      });
    }

    // ─────────────────────────────────────────────────
    // PAGE 4 — TAM VERİ TABLOSU
    // ─────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(16, 59, 45);
    doc.rect(0, 0, pageW, 52, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Tam Emisyon Veri Tablosu — Aktif Kaynaklar", mg, 32);

    const activeDetails = [...result.stepDetails]
      .filter((s) => s.emission > 0)
      .sort((a, b) => b.emission - a.emission);

    autoTable(doc, {
      startY: 66,
      head: [
        [
          "#",
          "Emisyon Kaynagi",
          "Grup",
          "Birim",
          "Miktar",
          "Katsayi",
          "Emisyon (kgCO2e)",
          "Oran",
        ],
      ],
      body: activeDetails.map((item, idx) => [
        idx + 1,
        item.stepLabel,
        item.groupTitle,
        item.unit,
        item.value.toFixed(2),
        item.factor.toFixed(4),
        item.emission.toFixed(2),
        result.grandTotal > 0
          ? `%${((item.emission / result.grandTotal) * 100).toFixed(1)}`
          : "0%",
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [16, 59, 45], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 248, 244] },
      footStyles: { fillColor: [220, 235, 228], fontStyle: "bold" },
      foot: [
        ["", "TOPLAM", "", "", "", "", result.grandTotal.toFixed(2), "100%"],
      ],
      showFoot: "lastPage",
      columnStyles: {
        0: { cellWidth: 24, halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    // ─── Footer on every page ───
    const pageCount = (
      doc as jsPDF & { getNumberOfPages(): number }
    ).getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `${companyName || "Karbon Raporu"} | ${getPeriodLabel()} | ${today}`,
        mg,
        pageH - 18,
      );
      doc.text(`Sayfa ${p} / ${pageCount}`, pageW - mg, pageH - 18, {
        align: "right",
      });
    }

    doc.save(`karbon-yonetici-raporu-${getPeriodLabel()}.pdf`);
    setStatusMessage("Yonetici PDF raporu indirildi.");
  };

  useEffect(() => {
    const initialFactors = Object.fromEntries(
      defaultGroups.flatMap((group) =>
        group.steps.map((step) => [step.id, step.factor]),
      ),
    ) as Record<string, number>;
    setFactors(initialFactors);
    void loadFactorsFromStaticFiles();
    void loadRecentRecords();
    void loadAnalytics(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadAnalytics(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  return (
    <>
      <div className="bg-shape bg-shape-left" />
      <div className="bg-shape bg-shape-right" />
      <main className="container">
        <header className="hero">
          <p className="eyebrow">Kurumsal Karbon Ayak Izi</p>
          <h1>Detayli Hesaplama ve Raporlama</h1>
          <p className="hero-text">
            Miktar x Katsayi mantigiyla adim bazinda hesaplayin, sonuclari
            kaydedin, aylik-yillik trendleri izleyin ve raporu PDF/Excel olarak
            indirin.
          </p>
        </header>

        <Controls
          companyName={companyName}
          periodType={periodType}
          month={month}
          year={year}
          statusMessage={statusMessage}
          onCompanyNameChange={setCompanyName}
          onPeriodTypeChange={setPeriodType}
          onMonthChange={setMonth}
          onYearChange={setYear}
        />

        <section className="wizard-nav">
          <div
            className="wizard-steps"
            role="list"
            aria-label="Hesaplama adimlari"
          >
            {defaultGroups.map((group, index) => (
              <span
                key={group.id}
                role="listitem"
                className={`wizard-step ${index === currentWizardStep ? "active" : ""} ${
                  index < currentWizardStep ? "done" : ""
                }`}
              >
                {index + 1}. {group.title}
              </span>
            ))}
            <span
              role="listitem"
              className={`wizard-step ${isResultStep ? "active" : ""}`}
            >
              4. Sonuc
            </span>
          </div>

          {!isResultStep && (
            <div className="wizard-actions">
              <button
                id="reset-btn"
                type="button"
                onClick={() => {
                  setValues({});
                  setStatusMessage("Tum miktar degerleri sifirlandi.");
                }}
              >
                Degerleri Sifirla
              </button>
              {currentWizardStep > 0 && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setCurrentWizardStep((prev) => prev - 1)}
                >
                  Geri
                </button>
              )}
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  if (currentWizardStep === wizardStepCount - 1) {
                    setCurrentWizardStep(wizardStepCount);
                    setStatusMessage(
                      "Tum adimlar tamamlandi. Sonuc ekranina gecildi.",
                    );
                    return;
                  }
                  setCurrentWizardStep((prev) => prev + 1);
                }}
              >
                {currentWizardStep === wizardStepCount - 1
                  ? "Sonucu Gor"
                  : "Ileri"}
              </button>
            </div>
          )}
        </section>

        <SummaryCards
          grandTotal={result.grandTotal}
          totalSteps={result.totalSteps}
          activeInputs={result.activeInputs}
        />

        {!isResultStep && activeGroup && (
          <GroupList
            groups={[activeGroup]}
            values={values}
            factors={factors}
            groupTotals={groupTotals}
            stepResults={stepResults}
            onValueChange={(stepId, value) => {
              setValues((prev) => ({ ...prev, [stepId]: value }));
            }}
          />
        )}

        {isResultStep && (
          <>
            <section className="result-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setCurrentWizardStep(wizardStepCount - 1)}
              >
                Forma Geri Don
              </button>
              <button id="save-btn" type="button" onClick={saveRecord}>
                Sonucu Kaydet
              </button>
              <button id="pdf-btn" type="button" onClick={exportToPdf}>
                PDF Disa Aktar
              </button>
              <button id="excel-btn" type="button" onClick={exportToExcel}>
                Excel Disa Aktar
              </button>
            </section>

            <DetailsSection
              groupBreakdown={result.groupTotals.map((item) => ({
                title: item.groupTitle,
                total: item.total,
              }))}
              topSteps={topSteps}
              generalTotal={result.grandTotal}
              activeInputs={result.activeInputs}
              totalSteps={result.totalSteps}
              topThreeShare={keyInsights.topThreeShare}
              highestSourceLabel={keyInsights.highestSourceLabel}
              highestSourceValue={keyInsights.highestSourceValue}
              reductionPotential={keyInsights.reductionPotential}
              recommendations={keyInsights.recommendations}
            />

            <ChartsSection year={year} analytics={analytics} />
            <RecordsSection records={records} />
          </>
        )}
      </main>
    </>
  );
}
