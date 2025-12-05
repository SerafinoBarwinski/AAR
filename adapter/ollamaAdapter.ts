// adapters/ollamaAdapter.ts
import { AIAdapter } from './adapterBase';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class OllamaAdapter implements AIAdapter {
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string) {
    // Beispiel: Ollama CLI-Aufruf
    const command = `ollama generate ${this.model} --system "${systemPrompt}" --prompt "${userPrompt}"`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      throw new Error(`Ollama error: ${stderr}`);
    }

    return { text: stdout.trim(), meta: { model: this.model } };
  }
}
