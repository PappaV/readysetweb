import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { PersistentStore } from "@demo-site-generator/autopilot";
import { MAINTENANCE_TIERS } from "@demo-site-generator/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
// When run via tsx from src/, public/ is one level up at the package root
const publicDir = resolve(__dirname, "..", "public");
const storePath = process.env.AUTOPILOT_STORE ?? "./data/autopilot.json";
const store = new PersistentStore(storePath);

const app = express();
app.use(express.json());

// Dashboard page
app.get("/", (_req, res) => {
  res.sendFile(join(publicDir, "index.html"));
});

// API: overall stats + revenue projection
app.get("/api/stats", (_req, res) => {
  const stats = store.getStats();
  const leads = store.getAllLeads();

  const sent = leads.filter((l) => l.status === "sent").length;
  const approved = leads.filter((l) => l.status === "approved").length;
  const delivered = leads.filter((l) => l.status === "delivered").length;
  const awaiting = leads.filter((l) => l.status === "awaiting-approval").length;

  // Revenue projection: assume approved leads convert to subscribers eventually
  const meta = store.getMeta();
  const revenue = {
    mrr: Number(meta.mrr ?? 0), // actual MRR from subscriptions (set manually)
    projected: {
      at50pct: Math.round((approved + delivered + sent) * 0.5) * MAINTENANCE_TIERS[1].priceMonthly,
      at25pct: Math.round((approved + delivered + sent) * 0.25) * MAINTENANCE_TIERS[1].priceMonthly,
    },
  };

  res.json({
    ...stats,
    mode: meta.mode ?? "review",
    revenue,
    tiers: MAINTENANCE_TIERS,
    goal: 180000,
  });
});

// API: all leads
app.get("/api/leads", (_req, res) => {
  res.json(store.getAllLeads());
});

// API: all jobs
app.get("/api/jobs", (_req, res) => {
  res.json(store.getAllJobs());
});

// API: update lead status
app.post("/api/leads/:id/status", (req, res) => {
  const { status } = req.body;
  const lead = store.getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  if (!["discovered", "previewing", "awaiting-approval", "approved", "rejected", "sent", "delivered", "failed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  store.updateLead(req.params.id, { status });
  res.json({ ok: true });
});

// API: set MRR manually (track actual subscription income)
app.post("/api/mrr", (req, res) => {
  const value = Number(req.body?.value ?? 0);
  store.upsertMeta({ mrr: value });
  res.json({ ok: true, mrr: value });
});

// API: switch between review and auto mode
app.post("/api/mode", (req, res) => {
  const mode = req.body?.mode;
  if (mode !== "review" && mode !== "auto") {
    return res.status(400).json({ error: "mode must be review | auto" });
  }
  store.upsertMeta({ mode });
  res.json({ ok: true, mode });
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "dashboard" }));

const port = Number(process.env.DASHBOARD_PORT ?? 3001);
app.listen(port, () => {
  console.log(`Dashboard running on http://localhost:${port}`);
});
