import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "karbon.db");
const factorsPath = path.join(__dirname, "db.json");

// ⚠️ Üretim ortamında bu değeri process.env.JWT_SECRET ile ortam değişkeninden okuyun
const JWT_SECRET = process.env.JWT_SECRET || "karbon-ayak-izi-secret-key-2026";
const JWT_EXPIRES_IN = "7d";

const app = express();
const port = 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// ─── SQLite DB ────────────────────────────────────────────────────────────────

const db = new Database(dbPath);

// ─── Factors (JSON file) ─────────────────────────────────────────────────────

const readFactors = async () => {
  const raw = await fs.readFile(factorsPath, "utf-8");
  return JSON.parse(raw).factors ?? {};
};

const writeFactors = async (factors) => {
  let db = {};
  try {
    const raw = await fs.readFile(factorsPath, "utf-8");
    db = JSON.parse(raw);
  } catch {}
  db.factors = factors;
  await fs.writeFile(factorsPath, JSON.stringify(db, null, 2), "utf-8");
};

// ─── DB Init ─────────────────────────────────────────────────────────────────

function initializeDb() {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS Companies (
      Id TEXT PRIMARY KEY,
      Name TEXT NOT NULL,
      TaxNumber TEXT DEFAULT '',
      Sector TEXT DEFAULT '',
      Address TEXT DEFAULT '',
      ContactEmail TEXT DEFAULT '',
      ContactPhone TEXT DEFAULT '',
      CreatedAt TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS Users (
      Id TEXT PRIMARY KEY,
      Name TEXT NOT NULL,
      Email TEXT NOT NULL UNIQUE,
      PasswordHash TEXT NOT NULL,
      CompanyId TEXT NOT NULL,
      CreatedAt TEXT DEFAULT '',
      FOREIGN KEY (CompanyId) REFERENCES Companies(Id)
    );

    CREATE TABLE IF NOT EXISTS Records (
      Id TEXT PRIMARY KEY,
      CompanyId TEXT,
      CompanyName TEXT DEFAULT '',
      CreatedAt TEXT DEFAULT '',
      PeriodType TEXT DEFAULT 'monthly',
      Month INTEGER,
      Year INTEGER,
      GrandTotal REAL DEFAULT 0,
      GroupTotals TEXT DEFAULT '[]',
      StepDetails TEXT DEFAULT '[]'
    );
  `);

  // Migrate old db.json records if Records table is empty
  const count = db.prepare("SELECT COUNT(*) as cnt FROM Records").get().cnt;
  if (count === 0) {
    migrateFromJson();
  }

  console.log("Veritabani hazir:", dbPath);
}

function migrateFromJson() {
  try {
    const raw = require("node:fs").readFileSync(factorsPath, "utf-8");
    const data = JSON.parse(raw);
    const records = data.records ?? [];
    if (records.length === 0) return;
    console.log(`${records.length} eski kayit SQLite DB'ye aktariliyor...`);
    const insert = db.prepare(`
      INSERT OR IGNORE INTO Records
        (Id, CompanyId, CompanyName, CreatedAt, PeriodType, Month, Year, GrandTotal, GroupTotals, StepDetails)
      VALUES
        (@id, @companyId, @companyName, @createdAt, @periodType, @month, @year, @grandTotal, @groupTotals, @stepDetails)
    `);
    const migrate = db.transaction((rows) => {
      for (const r of rows) {
        insert.run({
          id: r.id || randomUUID(),
          companyId: r.companyId ?? null,
          companyName: r.companyName ?? "",
          createdAt: r.createdAt ?? new Date().toISOString(),
          periodType: r.periodType === "yearly" ? "yearly" : "monthly",
          month: r.month != null ? Number(r.month) : null,
          year: Number(r.year) || new Date().getFullYear(),
          grandTotal: Number(r.grandTotal) || 0,
          groupTotals: JSON.stringify(r.groupTotals ?? []),
          stepDetails: JSON.stringify(r.stepDetails ?? []),
        });
      }
    });
    migrate(records);
    console.log("Migrasyon tamamlandi.");
  } catch (err) {
    console.warn("Migrasyon hatasi (devam ediliyor):", err.message);
  }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Giris yapmaniz gerekiyor." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Gecersiz veya suresi dolmus oturum." });
  }
}

// ─── Routes: Auth ─────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, companyName, sector, taxNumber, address, contactEmail, contactPhone } = req.body ?? {};

    if (!name?.trim()) return res.status(400).json({ message: "Ad zorunludur." });
    if (!email?.trim()) return res.status(400).json({ message: "E-posta zorunludur." });
    if (!password || password.length < 6) return res.status(400).json({ message: "Sifre en az 6 karakter olmalidir." });
    if (!companyName?.trim()) return res.status(400).json({ message: "Firma adi zorunludur." });

    const existing = db.prepare("SELECT Id FROM Users WHERE Email = ?").get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ message: "Bu e-posta adresi zaten kayitli." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const companyId = randomUUID();
    const userId = randomUUID();
    const now = new Date().toISOString();

    const insertCompanyAndUser = db.transaction(() => {
      db.prepare(`
        INSERT INTO Companies (Id, Name, TaxNumber, Sector, Address, ContactEmail, ContactPhone, CreatedAt)
        VALUES (@id, @name, @taxNumber, @sector, @address, @contactEmail, @contactPhone, @createdAt)
      `).run({
        id: companyId,
        name: companyName.trim(),
        taxNumber: taxNumber ?? "",
        sector: sector ?? "",
        address: address ?? "",
        contactEmail: contactEmail ?? "",
        contactPhone: contactPhone ?? "",
        createdAt: now,
      });

      db.prepare(`
        INSERT INTO Users (Id, Name, Email, PasswordHash, CompanyId, CreatedAt)
        VALUES (@id, @name, @email, @passwordHash, @companyId, @createdAt)
      `).run({
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        companyId,
        createdAt: now,
      });
    });

    insertCompanyAndUser();

    const token = jwt.sign(
      { userId, name: name.trim(), email: email.trim().toLowerCase(), companyId, companyName: companyName.trim() },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.status(201).json({
      message: "Kayit basarili.",
      token,
      user: { id: userId, name: name.trim(), email: email.trim().toLowerCase(), companyId, companyName: companyName.trim() },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Kayit yapilamadi." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "E-posta ve sifre zorunludur." });
    }

    const user = db.prepare("SELECT u.*, c.Name AS CompanyName FROM Users u JOIN Companies c ON u.CompanyId = c.Id WHERE u.Email = ?").get(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ message: "E-posta veya sifre hatali." });
    }

    const valid = await bcrypt.compare(password, user.PasswordHash);
    if (!valid) {
      return res.status(401).json({ message: "E-posta veya sifre hatali." });
    }

    const token = jwt.sign(
      { userId: user.Id, name: user.Name, email: user.Email, companyId: user.CompanyId, companyName: user.CompanyName },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.json({
      message: "Giris basarili.",
      token,
      user: { id: user.Id, name: user.Name, email: user.Email, companyId: user.CompanyId, companyName: user.CompanyName },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Giris yapilamadi." });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  const user = db.prepare("SELECT u.Id, u.Name, u.Email, u.CompanyId, c.Name AS CompanyName FROM Users u JOIN Companies c ON u.CompanyId = c.Id WHERE u.Id = ?").get(req.user.userId);
  if (!user) return res.status(404).json({ message: "Kullanici bulunamadi." });
  return res.json({ user: { id: user.Id, name: user.Name, email: user.Email, companyId: user.CompanyId, companyName: user.CompanyName } });
});

// ─── Routes: Health ───────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

// ─── Routes: Factors ─────────────────────────────────────────────────────────

app.get("/api/factors", authenticateToken, async (_req, res) => {
  try {
    const factors = await readFactors();
    res.json({ factors, count: Object.keys(factors).length });
  } catch (_error) {
    res.status(500).json({ message: "Katsayilar okunamadi." });
  }
});

app.put("/api/factors", authenticateToken, async (req, res) => {
  try {
    const incomingFactors = req.body?.factors;
    if (!incomingFactors || typeof incomingFactors !== "object") {
      return res
        .status(400)
        .json({ message: "Gecerli factors nesnesi gerekli." });
    }
    const existing = await readFactors();
    const updated = { ...existing, ...incomingFactors };
    await writeFactors(updated);
    return res.json({ message: "Katsayilar guncellendi.", factors: updated });
  } catch (_error) {
    return res.status(500).json({ message: "Katsayilar guncellenemedi." });
  }
});

// ─── Routes: Companies ───────────────────────────────────────────────────────

app.get("/api/companies", authenticateToken, (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM Companies ORDER BY Name").all();
    const companies = rows.map((r) => ({
      id: r.Id,
      name: r.Name,
      taxNumber: r.TaxNumber ?? "",
      sector: r.Sector ?? "",
      address: r.Address ?? "",
      contactEmail: r.ContactEmail ?? "",
      contactPhone: r.ContactPhone ?? "",
      createdAt: r.CreatedAt ?? "",
    }));
    res.json({ companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Firmalar okunamadi." });
  }
});

app.post("/api/companies", authenticateToken, (req, res) => {
  try {
    const { name, taxNumber, sector, address, contactEmail, contactPhone } =
      req.body ?? {};
    if (!name?.trim()) {
      return res.status(400).json({ message: "Firma adi zorunludur." });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO Companies (Id, Name, TaxNumber, Sector, Address, ContactEmail, ContactPhone, CreatedAt)
      VALUES (@id, @name, @taxNumber, @sector, @address, @contactEmail, @contactPhone, @createdAt)
    `).run({
      id,
      name: name.trim(),
      taxNumber: taxNumber ?? "",
      sector: sector ?? "",
      address: address ?? "",
      contactEmail: contactEmail ?? "",
      contactPhone: contactPhone ?? "",
      createdAt,
    });
    return res.status(201).json({
      message: "Firma olusturuldu.",
      company: {
        id,
        name: name.trim(),
        taxNumber: taxNumber ?? "",
        sector: sector ?? "",
        address: address ?? "",
        contactEmail: contactEmail ?? "",
        contactPhone: contactPhone ?? "",
        createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Firma olusturulamadi." });
  }
});

app.put("/api/companies/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, taxNumber, sector, address, contactEmail, contactPhone } =
      req.body ?? {};
    if (!name?.trim()) {
      return res.status(400).json({ message: "Firma adi zorunludur." });
    }
    db.prepare(`
      UPDATE Companies SET
        Name = @name,
        TaxNumber = @taxNumber,
        Sector = @sector,
        Address = @address,
        ContactEmail = @contactEmail,
        ContactPhone = @contactPhone
      WHERE Id = @id
    `).run({
      id,
      name: name.trim(),
      taxNumber: taxNumber ?? "",
      sector: sector ?? "",
      address: address ?? "",
      contactEmail: contactEmail ?? "",
      contactPhone: contactPhone ?? "",
    });
    return res.json({ message: "Firma guncellendi." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Firma guncellenemedi." });
  }
});

// ─── Routes: Records ─────────────────────────────────────────────────────────

app.get("/api/records", authenticateToken, (req, res) => {
  try {
    const companyId = req.user.companyId;
    const rows = db.prepare(
      "SELECT Id, CompanyId, CompanyName, CreatedAt, PeriodType, Month, Year, GrandTotal FROM Records WHERE CompanyId = ? ORDER BY CreatedAt DESC",
    ).all(companyId);
    const records = rows.map((r) => ({
      id: r.Id,
      companyId: r.CompanyId ?? null,
      companyName: r.CompanyName ?? "",
      createdAt: r.CreatedAt ?? "",
      periodType: r.PeriodType ?? "monthly",
      month: r.Month ?? null,
      year: r.Year ?? new Date().getFullYear(),
      grandTotal: r.GrandTotal ?? 0,
    }));
    res.json({ records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Kayitlar okunamadi." });
  }
});

app.get("/api/records/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const r = db.prepare("SELECT * FROM Records WHERE Id = ? AND CompanyId = ?").get(id, req.user.companyId);
    if (!r) {
      return res.status(404).json({ message: "Kayit bulunamadi." });
    }
    let groupTotals = [];
    let stepDetails = [];
    try { groupTotals = JSON.parse(r.GroupTotals ?? "[]"); } catch {}
    try { stepDetails = JSON.parse(r.StepDetails ?? "[]"); } catch {}
    return res.json({
      id: r.Id,
      companyId: r.CompanyId ?? null,
      companyName: r.CompanyName ?? "",
      createdAt: r.CreatedAt ?? "",
      periodType: r.PeriodType ?? "monthly",
      month: r.Month ?? null,
      year: r.Year ?? new Date().getFullYear(),
      grandTotal: r.GrandTotal ?? 0,
      groupTotals,
      stepDetails,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Kayit okunamadi." });
  }
});

app.post("/api/records", authenticateToken, (req, res) => {
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

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const companyId = req.user.companyId;
    const companyName = req.user.companyName;
    const month = payload.month != null ? Number(payload.month) : null;

    db.prepare(`
      INSERT INTO Records (Id, CompanyId, CompanyName, CreatedAt, PeriodType, Month, Year, GrandTotal, GroupTotals, StepDetails)
      VALUES (@id, @companyId, @companyName, @createdAt, @periodType, @month, @year, @grandTotal, @groupTotals, @stepDetails)
    `).run({
      id,
      companyId,
      companyName,
      createdAt,
      periodType: payload.periodType === "yearly" ? "yearly" : "monthly",
      month,
      year: Number(payload.year) || new Date().getFullYear(),
      grandTotal: Number(payload.grandTotal) || 0,
      groupTotals: JSON.stringify(payload.groupTotals ?? []),
      stepDetails: JSON.stringify(payload.stepDetails ?? []),
    });

    return res.status(201).json({
      message: "Kayit basariyla olusturuldu.",
      record: {
        id,
        companyId,
        companyName,
        createdAt,
        periodType: payload.periodType,
        month,
        year: Number(payload.year),
        grandTotal: Number(payload.grandTotal) || 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Kayit olusturulamadi." });
  }
});

// ─── Routes: Analytics ───────────────────────────────────────────────────────

app.get("/api/analytics", authenticateToken, (req, res) => {
  try {
    const yearParam = Number(req.query.year);
    const selectedYear =
      Number.isFinite(yearParam) && yearParam > 0
        ? yearParam
        : new Date().getFullYear();

    const rows = db
      .prepare("SELECT Year, Month, PeriodType, GrandTotal FROM Records WHERE CompanyId = ?")
      .all(req.user.companyId);

    const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      total: 0,
    }));
    const yearlyMap = new Map();

    for (const r of rows) {
      const year = Number(r.Year);
      const total = Number(r.GrandTotal) || 0;
      if (!Number.isFinite(year) || year <= 0) continue;
      yearlyMap.set(year, (yearlyMap.get(year) ?? 0) + total);
      if (
        year === selectedYear &&
        r.PeriodType === "monthly" &&
        Number(r.Month) >= 1 &&
        Number(r.Month) <= 12
      ) {
        monthlyTotals[Number(r.Month) - 1].total += total;
      }
    }

    const yearlyTotals = [...yearlyMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, total]) => ({ year, total }));

    return res.json({ selectedYear, monthlyTotals, yearlyTotals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Analitik verisi olusturulamadi." });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

initializeDb();
app.listen(port, () => {
  console.log(`Karbon API ayakta: http://localhost:${port}`);
});
