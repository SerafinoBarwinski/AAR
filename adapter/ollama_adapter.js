import ollama from 'ollama'

module.exports = {
  id: "ollama_adapter",
  name: "Ollama Adapter",
  description: "Adapter module to interact with Ollama AI models",
  capabilities: ["READ", "WRITE"],

  // Unused rn
  dependencies: {
    ollama: "ollama"
  },

  commands: {
    getModels: {
      description: "Returns a list of available Ollama models",
      handler: async () => {
        const { models } = await ollama.list();
        return models.map(m => m.name);
      }
    },

    generateText: {
      description: "Generates text from a specific Ollama model",
      handler: async ({ model, prompt }) => {
        // ECHTER Textgenerator-Aufruf der Ollama-API
        const response = await ollama.generate({
          model,
          prompt,
          stream: false
        });

        return response.response;
      }
    }
  }
};
