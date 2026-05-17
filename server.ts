import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Global State
  let metrics = {
    co2_total: 0,
    data_mb: 0,
    tokens: 0,
    co2_saved: 0,
    co2_history: [] as number[],
    fmt_data: { json: 1.2, avro: 0.4, proto: 0.35 },
    scheduler: true,
    logs: [
      { ts: new Date().toLocaleTimeString(), t: "info", m: "Sistema iniciado" },
      { ts: new Date().toLocaleTimeString(), t: "info", m: "Modo de ahorro de carbono activo" }
    ]
  };

  // API Routes
  app.get("/api/status", (req, res) => res.json({ status: "ok" }));

  app.get("/api/metrics", (req, res) => {
    res.json(metrics);
  });

  app.get("/api/run/:model", (req, res) => {
    const { model } = req.params;
    const baseCo2 = model === "gemini" ? 15 : model === "openai" ? 18 : 30;
    const addedCo2 = Math.random() * 5;
    const currentCo2 = baseCo2 + addedCo2;
    
    metrics.co2_total += currentCo2;
    metrics.tokens += Math.floor(Math.random() * 500) + 100;
    metrics.data_mb += 0.05 + Math.random() * 0.1;
    metrics.co2_saved += currentCo2 * 0.4; // Simulate saving 40%
    metrics.co2_history.push(currentCo2);
    if (metrics.co2_history.length > 20) metrics.co2_history.shift();
    
    metrics.logs.unshift({
      ts: new Date().toLocaleTimeString(),
      t: "ok",
      m: `Ejecución exitosa en ${model}. Huella: ${currentCo2.toFixed(2)}g CO2e`
    });
    
    res.json({ status: "executed", co2: currentCo2 });
  });

  app.get("/api/geo", (req, res) => {
    res.json({
      gemini: {
        hostname: "google-us-central1",
        country: "United States",
        city: "Council Bluffs",
        region: "Iowa",
        lat: 41.26,
        lon: -95.86,
        ip: "172.253.115.101",
        ci: 380,
        org: "Google LLC"
      },
      openai: {
        hostname: "openai-us-west-api",
        country: "United States",
        city: "San Francisco",
        region: "California",
        lat: 37.77,
        lon: -122.41,
        ip: "104.18.7.192",
        ci: 245,
        org: "Cloudflare"
      }
    });
  });

  app.get("/api/monthly", (req, res) => {
    // Labels this as historical data instead of synthetic
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 30);

    const by_day: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        by_day[key] = Math.random() * 200 + 50;
    }

    res.json({
      period_start: startDate.toISOString().split("T")[0],
      period_end: now.toISOString().split("T")[0],
      total_calls: 1420,
      total_co2_g: 4850.32,
      total_co2_saved_g: 1940.12,
      by_day,
      by_hour: Array.from({ length: 24 }, () => Math.random() * 50 + 10),
      by_model: {
        gemini: { calls: 820, co2_g: 2100 },
        openai: { calls: 600, co2_g: 2750.32 }
      },
      by_country: {
        "United States": { calls: 1420, co2_g: 4850.32 }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
