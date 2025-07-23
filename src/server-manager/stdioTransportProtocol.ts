import { Readable, Writable } from "node:stream";
import * as readline from "readline";

export interface JSONRPCMessage {
  jsonrpc: "2.0";
  error?: { code: number; message: string };
  id: string | number | null;
}

export interface JSONRPCRequest extends JSONRPCMessage {
  method: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
}

export interface JSONRPCResponse extends JSONRPCMessage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
}

export class StdioTransport {
  private rl: readline.Interface;
  private onmessage?: (message: JSONRPCMessage) => void;
  private bufferChunks: string[] = [];
  private isStarted = false;

  // Store bound methods to ensure proper cleanup
  private readonly dataHandler = (chunk: Buffer) => {
    this.bufferChunks.push(chunk.toString());
    this.processBuffer();
  };

  constructor(
    private _stdin: Readable = process.stdin,
    private _stdout: Writable = process.stdout,
  ) {
    this.rl = readline.createInterface({
      input: this._stdin,
      output: this._stdout,
      terminal: false,
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return; // Prevent double initialization
    }

    this.isStarted = true;
    this._stdin.on("data", this.dataHandler);
  }

  private processBuffer(): void {
    // Join all chunks and split by lines - more efficient than string concatenation
    const fullBuffer = this.bufferChunks.join("");
    const lines = fullBuffer.split("\n");

    // Keep the last line in buffer if it's incomplete
    const incompleteLine = lines.pop() || "";

    // Clear chunks and store incomplete line
    this.bufferChunks = incompleteLine ? [incompleteLine] : [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line.trim()) as JSONRPCMessage;
        if (message.error) {
          process.stderr.write(
            `Server error: ${JSON.stringify(message.error)}\n`,
          );
        }
        this.onmessage?.(message);
      } catch (error) {
        process.stderr.write(`Failed to parse line: ${line}\n`);
        process.stderr.write(`Parse error: ${error}\n`);
        process.stderr.write(
          `Current buffer chunks: ${this.bufferChunks.length}\n`,
        );
      }
    }
  }

  async send(message: JSONRPCRequest | JSONRPCResponse): Promise<void> {
    const messageStr = JSON.stringify(message) + "\n";
    this._stdout.write(messageStr);
  }

  async close(): Promise<void> {
    if (this.isStarted) {
      this._stdin.removeListener("data", this.dataHandler);
      this.isStarted = false;
    }

    this.bufferChunks = [];
    this.onmessage = undefined;
    this.rl.close();
  }

  setOnMessage(handler: (message: JSONRPCMessage) => void) {
    this.onmessage = handler;
  }
}
