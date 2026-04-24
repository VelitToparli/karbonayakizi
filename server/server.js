import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "db.json");

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const readDb = async () => {
  const raw = await fs.readFile(dbPath, "utf-8");
  return JSON.parse(raw);
};

const writeDb = async (db) => {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf-8");
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

app.get("/api/factors", async (_req, res) => {
  try {
    const db = await readDb();
    res.json({ factors: db.factors, count: Object.keys(db.factors).length });
  } catch (_error) {
    res.status(500).json({ message: "Katsayilar okunamadi." });
  }
});

app.put("/api/factors", async (req, res) => {
  try {
    const incomingFactors = req.body?.factors;
    if (!incomingFactors || typeof incomingFactors !== "object") {
      return res
        .status(400)
        .json({ message: "Gecerli factors nesnesi gerekli." });
    }

    const db = await readDb();
    db.factors = { ...db.factors, ...incomingFactors };
    await writeDb(db);

    return res.json({
      message: "Katsayilar guncellendi.",
      factors: db.factors,
    });
  } catch (_error) {
    return res.status(500).json({ message: "Katsayilar guncellenemedi." });
  }
});

app.get("/api/records", async (_req, res) => {
  try {
    const db = await readDb();
    const records = [...db.records].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.json({ records });
  } catch (_error) {
    res.status(500).json({ message: "Kayitlar okunamadi." });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ message: "Gecerli kayit verisi gerekli." });
    }

    const required = [
      "companyName",
      "periodType",
      "year",
      "grandTotal",
      "groupTotals",
      "stepDetails",
    ];
    for (const key of required) {
      if (!(key in payload)) {
        return res.status(400).json({ message: `Eksik alan: ${key}` });
      }
    }

    const db = await readDb();
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      companyName: String(payload.companyName),
      periodType: payload.periodType === "yearly" ? "yearly" : "monthly",
      year: Number(payload.year),
      month: payload.month ? Number(payload.month) : null,
      grandTotal: Number(payload.grandTotal) || 0,
      groupTotals: payload.groupTotals,
      stepDetails: payload.stepDetails,
    };

    db.records.push(record);
    await writeDb(db);

    return res
      .status(201)
      .json({ message: "Kayit basariyla olusturuldu.", record });
  } catch (_error) {
    return res.status(500).json({ message: "Kayit olusturulamadi." });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const yearParam = Number(req.query.year);
    const selectedYear =
      Number.isFinite(yearParam) && yearParam > 0
        ? yearParam
        : new Date().getFullYear();
    const db = await readDb();

    const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      total: 0,
    }));

    const yearlyMap = new Map();

    for (const record of db.records) {
      const year = Number(record.year);
      const total = Number(record.grandTotal) || 0;
      if (!Number.isFinite(year) || year <= 0) continue;

      yearlyMap.set(year, (yearlyMap.get(year) ?? 0) + total);

      if (
        year === selectedYear &&
        record.periodType === "monthly" &&
        Number(record.month) >= 1 &&
        Number(record.month) <= 12
      ) {
        monthlyTotals[Number(record.month) - 1].total += total;
      }
    }

    const yearlyTotals = [...yearlyMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, total]) => ({ year, total }));

    return res.json({
      selectedYear,
      monthlyTotals,
      yearlyTotals,
    });
  } catch (_error) {
    return res.status(500).json({ message: "Analitik verisi olusturulamadi." });
  }
});

app.listen(port, () => {
  console.log(`Karbon API ayakta: http://localhost:${port}`);
});
