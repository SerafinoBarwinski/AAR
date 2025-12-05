import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modulesPath = path.join(__dirname, "..", "modules");

let logging = process.argv.slice(2) || "default";

const modules = await listModules()
const modules_loaded = [];

async function listModules() {
  const files = await fs.readdir(modulesPath);
  const jsFiles = files
    .filter(file => file.endsWith(".js"))
    .map(file => file.slice(0, -3));
  console.log("[LOG] Found", jsFiles.length, "Modules");
  if (logging == "debug") console.log("[DEBUG] Found Modules: ", jsFiles);
  return jsFiles;
}

async function loadModule(ModuleName) {
  if (!modules.includes(ModuleName)) {
    if (logging == "debug") console.log("[DEBUG] Cant find Module: ", ModuleName);
    return "Modul nicht gefunden."
  }
  const module = await import(path.join(modulesPath, ModuleName + ".js"));
  if (logging == "debug") console.log("[DEBUG] Loaded new Module: ", ModuleName);
  return "Modul erfolgreich Importiert"
}

loadModule("system")