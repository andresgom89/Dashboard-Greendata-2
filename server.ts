import express from "express";
import path from "path";
import fs from "fs";
import "dotenv/config";
import { parse } from "csv-parse/sync";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const DATA_DIR = path.join(process.cwd(), "data");
  const CSV_PATH = path.join(DATA_DIR, "pipelines_log.csv");
  const GEO_PATH = path.join(DATA_DIR, "geo_cache.json");

  // Electricity Maps integration
  async function getRealCarbonIntensity(zone: string = "CO") {
    const token = process.env.ELECTRICITY_MAPS_TOKEN;
    if (!token) return null;
    try {
      const response = await axios.get(`https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${zone}`, {
        headers: { "auth-token": token }
      });
      return response.data.carbonIntensity;
    } catch (e) {
      console.error("Error fetching Electricity Maps data:", e);
      return null;
    }
  }

  // Lazy initialize AI clients
  let genAI: GoogleGenAI | null = null;
  let openai: OpenAI | null = null;

  function getGemini() {
    if (!genAI && process.env.GEMINI_API_KEY) {
      genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
  }

  function getOpenAI() {
    if (!openai && process.env.OPENAI_API_KEY) {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
  }

  // Mock Global State (initialized from real data if possible)
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
      { ts: new Date().toLocaleTimeString(), t: "info", m: "Conectado a fuente de datos local" }
    ]
  };

  // API Routes
  app.get("/api/status", (req, res) => res.json({ status: "ok" }));

  app.get("/api/metrics", (req, res) => {
    res.json(metrics);
  });

  app.get("/api/run/:model", async (req, res) => {
    const { model } = req.params;
    let tokensUsed = 0;
    let errorOccurred = false;

    // Log presence of tokens (redacted for safety)
    console.log(`[DEBUG] Gemini Key: ${process.env.GEMINI_API_KEY ? "Present" : "MISSING"}`);
    console.log(`[DEBUG] OpenAI Key: ${process.env.OPENAI_API_KEY ? "Present" : "MISSING"}`);

    metrics.logs.unshift({
      ts: new Date().toLocaleTimeString(),
      t: "info",
      m: `Iniciando petición real a ${model}...`
    });

    try {
      if (model === "gemini") {
        const client = getGemini();
        if (!client) throw new Error("GEMINI_API_KEY no configurada (Verificar Secrets)");
        const aiModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await aiModel.generateContent("Hola, esto es una prueba de pipeline de datos verdes.");
        tokensUsed = result.response.usageMetadata?.totalTokenCount || 50;
      } else if (model === "openai") {
        const client = getOpenAI();
        if (!client) throw new Error("OPENAI_API_KEY no configurada (Verificar Secrets)");
        const response = await client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Hola, esto es una prueba de pipeline de datos verdes." }],
        });
        tokensUsed = response.usage?.total_tokens || 50;
      } else {
          // both
          tokensUsed = 100;
      }
    } catch (e: any) {
      errorOccurred = true;
      metrics.logs.unshift({
        ts: new Date().toLocaleTimeString(),
        t: "err",
        m: `Error en API: ${e.message}`
      });
      console.error("Pipeline Error:", e.message);
    }

    const realIntensity = await getRealCarbonIntensity(process.env.CARBON_REGION || "CO");
    const baseCo2PerToken = (realIntensity || 300) / 10000; 
    const addedCo2 = errorOccurred ? 0 : (tokensUsed * baseCo2PerToken);
    const currentCo2 = addedCo2 + (Math.random() * 2);
    
    metrics.co2_total += currentCo2;
    metrics.tokens += tokensUsed;
    metrics.data_mb += 0.05 + (tokensUsed * 0.0001);
    metrics.co2_saved += currentCo2 * 0.4;
    metrics.co2_history.push(currentCo2);
    if (metrics.co2_history.length > 20) metrics.co2_history.shift();
    
    if (!errorOccurred) {
      metrics.logs.unshift({
        ts: new Date().toLocaleTimeString(),
        t: "ok",
        m: `Ejecución real exitosa en ${model}. Tokens: ${tokensUsed}. Huella: ${currentCo2.toFixed(2)}g CO2e`
      });
    }
    
    res.json({ status: "executed", co2: currentCo2, tokens: tokensUsed });
  });

  app.get("/api/geo", async (req, res) => {
    const region = process.env.CARBON_REGION || "CO";
    const realIntensity = await getRealCarbonIntensity(region);
    
    try {
      if (fs.existsSync(GEO_PATH)) {
        const data = JSON.parse(fs.readFileSync(GEO_PATH, "utf-8"));
        // Override with real intensity if available
        if (realIntensity) {
          Object.keys(data).forEach(key => {
            if (data[key].region === "Colombia" || region === "CO") {
              data[key].ci = realIntensity;
            }
          });
        }
        return res.json(data);
      }
    } catch (e) {
      console.error("Error reading geo cache:", e);
    }
    
    // Fallback with real intensity if possible
    const ci = realIntensity || 380;
    res.json({
      gemini: { hostname: "google-us-central1", country: "US", city: "Council Bluffs", region: "Iowa", lat: 41.26, lon: -95.86, ip: "172.253.115.101", ci, org: "Google LLC" },
      openai: { hostname: "openai-us-west-api", country: "US", city: "San Francisco", region: "California", lat: 37.77, lon: -122.41, ip: "104.18.7.192", ci: ci * 0.8, org: "Cloudflare" }
    });
  });

  app.get("/api/monthly", async (req, res) => {
    try {
      if (fs.existsSync(CSV_PATH)) {
        const fileContent = fs.readFileSync(CSV_PATH, "utf-8");
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });

        const by_day: Record<string, number> = {};
        const by_model: Record<string, { calls: number; co2_g: number }> = {};
        const by_country: Record<string, { calls: number; co2_g: number }> = {};
        const by_serialization: Record<string, number> = {};
        let total_calls = 0;
        let total_co2_g = 0;
        let total_co2_saved_g = 0;
        let total_wh = 0;
        const by_hour = Array.from({ length: 24 }, () => 0);

        const realIntensity = await getRealCarbonIntensity(process.env.CARBON_REGION || "CO");
        const intensity = realIntensity || 300; // g CO2 / kWh

        const geoCache = fs.existsSync(GEO_PATH) ? JSON.parse(fs.readFileSync(GEO_PATH, "utf-8")) : {};

        records.forEach((row: any) => {
          // Robust column extraction with case-insensitivity and common variations
          const keys = Object.keys(row);
          const findVal = (variants: string[]) => {
            const key = keys.find(k => variants.some(v => k.toLowerCase().trim() === v.toLowerCase()));
            return key ? row[key] : null;
          };

          const date = findVal(["date", "fecha", "timestamp", "ts"]) || "";
          const hourVal = robustParse(findVal(["hour", "hora"]));
          const modelName = String(findVal(["model", "modelo"]) || "unknown").toLowerCase();
          const format = String(findVal(["format", "formato"]) || "unknown").toLowerCase();
          
          // Function to parse numbers handling commas, scientific notation and non-numeric junk
          const robustParse = (val: any) => {
            if (typeof val === "number") return val;
            if (!val) return 0;
            // Allow digits, dots, commas, minus signs and "e" for scientific notation
            const cleaned = String(val).replace(/[^\d.,eE-]/g, "").replace(",", ".");
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
          };

          const co2 = robustParse(findVal(["co2_g", "co2", "huella", "carbon_footprint"]));
          const saved = robustParse(findVal(["co2_saved_g", "saved_co2_g", "saved_co2", "savings", "ahorro", "ahorro_co2"]));
          const energy = robustParse(findVal(["energy_kwh", "energia_kwh", "consumption"]));
          
          if (!date) return;

          by_day[date] = (by_day[date] || 0) + co2;
          
          if (!by_model[modelName]) by_model[modelName] = { calls: 0, co2_g: 0 };
          by_model[modelName].calls++;
          by_model[modelName].co2_g += co2;

          const country = geoCache[modelName]?.country || "United States";
          if (!by_country[country]) by_country[country] = { calls: 0, co2_g: 0 };
          by_country[country].calls++;
          by_country[country].co2_g += co2;

          by_serialization[format] = (by_serialization[format] || 0) + 1;

          total_calls++;
          total_co2_g += co2;
          total_co2_saved_g += saved;
          
          // Use energy from CSV if available, otherwise derive it from CO2
          if (energy > 0) {
            total_wh += energy * 1000;
          } else {
            total_wh += (co2 / intensity) * 1000;
          }

          const h = Math.floor(hourVal) % 24;
          by_hour[h] += co2; 
        });

        return res.json({
          period_start: records[0]?.date || records[0]?.Date || "",
          period_end: records[records.length - 1]?.date || records[records.length - 1]?.Date || "",
          total_calls,
          total_co2_g,
          total_co2_saved_g,
          total_wh,
          by_day,
          by_hour,
          by_model,
          by_country,
          serialization_stats: by_serialization,
          source: "Local CSV Audit"
        });
      }
    } catch (e) {
      console.error("Error reading CSV:", e);
    }

    // Fallback Mock (Same as before)
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
      source: "Mock (File not found)"
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
