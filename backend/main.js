// Liste aller Adapter (Dateinamen oder IDs)
const AdapterNames = ["ollama_adapter"];
const AdapterLoaded = {};

async function loadAdapters(AdapterNames) {
  if (AdapterLoaded = "{}") { console.error("Failed to load adapter: Already loaded"); return; }
// Module dynamisch laden
moduleNames.forEach(name => {
  try {
    modules[name] = require(`./modules/${name}.js`);
    console.log(`Loaded adapter: ${name}`);
  } catch (err) {
    console.error(`Failed to load adapter '${name}':`, err.message);
  }
});
  console.log(modules["ollama_adapter"].name); // "Ollama Adapter"
}
