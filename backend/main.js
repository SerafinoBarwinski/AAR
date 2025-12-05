import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { loadEnvFile } from "node:process";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { Ollama } from 'ollama'

// ==================== SETUP ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const modulesPath = path.join(__filename, "..", "..", "modules");
const adapterPath = path.join(__filename, "..", "..", "adapter");
const USERS_FILE = path.join(__dirname, 'users.json');
const FrontendPath = path.join(__filename, "..", "..", "frontend");

// ENV laden
loadEnvFile(path.join(__dirname, "..", ".ENV"));

// Variablen
const logging = process.argv.slice(2) || "default";
const port = process.env.PORT || 3000;
const sessions = new Map();
let modules = [];
let modules_loaded = [];

// Adapter laden
let DEFAULT_AGENT_LLM = await loadAdapter(process.env.DEFAULT_AGENT_LLM + "_adapter");
let DEFAULT_AGENT_TTS = await loadAdapter(process.env.DEFAULT_AGENT_TTS + "_adapter");
let DEFAULT_AGENT_STT = await loadAdapter(process.env.DEFAULT_AGENT_STT + "_adapter");
let DEFAULT_AGENT_IMG = await loadAdapter(process.env.DEFAULT_AGENT_IMG + "_adapter");

if (DEFAULT_AGENT_LLM == "ollama" || DEFAULT_AGENT_TTS == "ollama" || DEFAULT_AGENT_STT == "ollama" || DEFAULT_AGENT_IMG == "ollama") {
  const ollama = new Ollama({ host: "http://localhost:${ process.env.OLLAMA_PORT }" });
}

// Express Setup
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(FrontendPath));

// ==================== MIDDLEWARE ====================
function secure(req, res, next) {
  const token = req.cookies.sessionToken;
  if (!token) return res.status(401).json({ success: false, message: 'Nicht authentifiziert' });

  const session = sessions.get(token);
  if (!session) {
    res.clearCookie('sessionToken');
    return res.status(401).json({ success: false, message: 'Ungültige Session' });
  }

  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    res.clearCookie('sessionToken');
    return res.status(401).json({ success: false, message: 'Session abgelaufen' });
  }

  req.user = session;
  next();
}

// ==================== ROUTES ====================
// Public Routes
app.get('/public', (req, res) => {
  res.json({ message: 'Öffentliche Seite' });
});

app.post('/rest/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username und Password erforderlich' });
  }

  const users = await loadUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, username: user.username, createdAt: Date.now() });

  res.cookie('sessionToken', token, {
    httpOnly: true,
    secure: false,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  });

  res.json({ success: true, message: 'Login erfolgreich', user: { id: user.id, username: user.username } });
});

// Protected Routes
app.get('/', secure, async (req, res) => {
  res.send(await runModule("time", "getDate"));
});

app.get('/dashboard', secure, (req, res) => {
  res.json({ message: 'Dashboard', user: req.user });
});

app.post('/rest/logout', secure, (req, res) => {
  sessions.delete(req.cookies.sessionToken);
  res.clearCookie('sessionToken');
  res.json({ success: true, message: 'Logout erfolgreich' });
});

// ==================== HELPER FUNCTIONS ====================
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    const defaultUsers = [
      { id: 1, username: 'admin', password: 'admin123' },
      { id: 2, username: 'user', password: 'user123' }
    ];
    await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
}

async function listModules() {
  const files = await fs.readdir(modulesPath);
  const jsFiles = files
    .filter(file => file.endsWith(".js"))
    .map(file => file.slice(0, -3));
  if (logging == "debug") console.log("[DEBUG] Found Modules:", jsFiles);
  return jsFiles;
}

async function loadModule(ModuleName) {
  if (!modules.includes(ModuleName)) {
    if (logging === "debug") console.log("[DEBUG] Cant find Module:", ModuleName);
    return null;
  }

  const imported = await import(path.join(modulesPath, ModuleName + ".js"));
  const moduleObj = imported.default || imported;
  if (logging === "debug") console.log("[DEBUG] Loaded new Module:", ModuleName);
  modules_loaded.push(ModuleName);
  return moduleObj;
}

async function runModule(ModuleName, commandName) {
  try {
    const module = await loadModule(ModuleName);

    if (!module?.commands?.[commandName]) {
      console.warn(`[WARN] Command "${commandName}" nicht gefunden in Modul "${ModuleName}".`);
      return null;
    }

    const handler = module.commands[commandName].handler;
    if (typeof handler !== "function") {
      console.warn(`[WARN] Handler für "${commandName}" ist keine Funktion.`);
      return null;
    }

    return await handler();
  } catch (err) {
    console.error(`[ERROR] Failed to run command "${commandName}" in module "${ModuleName}":`, err);
    return null;
  }
}

async function loadAllModules() {
  const moduleNames = await listModules();
  const loadedModules = {};

  for (const name of moduleNames) {
    try {
      loadedModules[name] = await loadModule(name);
    } catch (err) {
      console.error(`[ERROR] Failed to load module "${name}":`, err);
    }
  }

  console.log("[LOG] All modules loaded:", Object.keys(loadedModules));
  return loadedModules;
}

async function loadAdapter(AdapterName) {
  const imported = await import(path.join(adapterPath, AdapterName + ".js"));
  const moduleObj = imported.default || imported;
  if (logging === "debug") console.log("[DEBUG] Loaded Adapter:", AdapterName);
  return moduleObj;
}

// ==================== STARTUP ====================
(async () => {
  modules = await listModules();
  await loadAllModules();

  app.listen(port, () => {
    console.log(`🚀 ARR Backend läuft auf Port ${port}`);
    console.log(`📦 ${modules.length} Module gefunden`);
  });
})();