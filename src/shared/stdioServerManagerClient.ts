import { spawn } from "child_process";
import { ChildProcess } from "child_process";

export class StdioServerManagerClient {
  private serverProcess: ChildProcess | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private messageHandlers: Map<number, (result: any) => void>;
  private messageBuffer: string;
  private command: string;
  private args: string[];
  private env: NodeJS.ProcessEnv;

  constructor(command: string, args: string[], env?: NodeJS.ProcessEnv) {
    this.messageHandlers = new Map();
    this.messageBuffer = "";
    this.command = command;
    this.args = args;
    this.env = env ? { ...process.env, ...env } : process.env;
  }

  async start() {
    this.serverProcess = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: this.env,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.serverProcess.on("error", (err: any) => {
      process.stderr.write(`Server process error: ${err}\n`);
    });

    if (
      !this.serverProcess.stderr ||
      !this.serverProcess.stdout ||
      !this.serverProcess.stdin
    ) {
      throw new Error("Server process streams not available");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.serverProcess.stderr.on("data", (data: any) => {
      process.stderr.write(data);
    });

    this.serverProcess.stdout.on("data", (data: Buffer) => {
      this.messageBuffer += data.toString();
      const lines = this.messageBuffer.split("\n");
      this.messageBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line.trim());
          const handler = this.messageHandlers.get(message.id);
          if (handler) {
            handler(message);
            this.messageHandlers.delete(message.id);
          }
        } catch (e) {
          process.stderr.write(`Raw line: ${line}\n`);
          process.stderr.write(`Parse error: ${e}\n`);
        }
      }
    });

    this.serverProcess.on("exit", () => {
      for (const [, h] of this.messageHandlers)
        h({ __error__: { message: "Subprocess exited" } });
      this.messageHandlers.clear();
      this.serverProcess = null;
      this.messageBuffer = "";
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      if (!this.serverProcess?.stdin) {
        reject(Error("Server process not started"));
      } else {
        this.messageHandlers.set(id, (frame) => {
          if (frame.error || frame.__error__) {
            const msg =
              frame.error?.message ?? frame.__error__?.message ?? "MCP error";
            reject(new Error(msg));
          } else {
            resolve(frame.result);
          }
        });
        this.serverProcess.stdin.write(
          JSON.stringify({
            jsonrpc: "2.0",
            method,
            params,
            id,
          }) + "\n",
        );
      }

      setTimeout(() => {
        if (this.messageHandlers.has(id)) {
          this.messageHandlers.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }
      }, 60000);
    });
  }

  async stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      this.messageHandlers.clear();
      this.messageBuffer = "";
    }
  }
}
