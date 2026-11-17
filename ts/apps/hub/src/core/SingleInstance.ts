import { rmSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { userInfo } from "node:os";
import { join } from "node:path";

/**
 * Only one hub per user: a second start asks the first one to show its window and exits. The first one listens
 * on a local pipe (a named pipe on Windows, a Unix socket elsewhere).
 *
 * The pipe has the same name as the C# hub's (.NET's NamedPipe streams: \\.\pipe\&lt;name&gt; on Windows,
 * $TMPDIR/CoreFxPipe_&lt;name&gt; elsewhere), so either hub finds a running one.
 */
export class SingleInstance {
  private server: Server | null = null;
  private stopped = false;
  readonly pipe: string;

  constructor(name: string, platform: string = process.platform, env: Readonly<Record<string, string | undefined>> = process.env) {
    const pipeName = `${name}-${userName()}`;
    // Path.GetTempPath on Unix: $TMPDIR or /tmp/.
    this.pipe = platform === "win32" ? `\\\\.\\pipe\\${pipeName}` : join(env.TMPDIR || "/tmp/", `CoreFxPipe_${pipeName}`);
  }

  /** Asks a running instance to show itself. True when one answered (this one should exit). */
  notifyRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const client = connect(this.pipe);
      const timer = setTimeout(() => {
        client.destroy();
        resolve(false);
      }, 300);
      client.once("connect", () => {
        clearTimeout(timer);
        client.end(Buffer.from([1]), () => resolve(true));
      });
      client.once("error", () => {
        clearTimeout(timer);
        client.destroy();
        resolve(false);
      });
    });
  }

  /** Calls `onShow` every time another start asks. Resolves once it listens. */
  listen(onShow: () => void): Promise<void> {
    return new Promise((resolve) => {
      const start = (retry: boolean) => {
        if (this.stopped) return resolve();
        const server = createServer((socket) => {
          let shown = false;
          const show = () => {
            if (shown) return;
            shown = true;
            socket.destroy();
            onShow();
          };
          // ReadByte: one byte, or the end of the stream.
          socket.once("data", show);
          socket.once("end", show);
          socket.once("error", () => socket.destroy());
        });
        server.once("error", (e: NodeJS.ErrnoException) => {
          // A socket file left by a hub that did not exit cleanly (nobody answered notifyRunning): remove it.
          if (e.code === "EADDRINUSE" && retry && process.platform !== "win32") {
            rmSync(this.pipe, { force: true });
            start(false);
          } else {
            // IOException in C#: try again a little later.
            setTimeout(() => start(true), 500);
            resolve();
          }
        });
        server.listen(this.pipe, () => {
          this.server = server;
          resolve();
        });
      };
      start(true);
    });
  }

  dispose(): void {
    this.stopped = true;
    this.server?.close();
    this.server = null;
  }
}

/** Environment.UserName. */
function userName(): string {
  try {
    return userInfo().username;
  } catch {
    return process.env.USER ?? process.env.USERNAME ?? "user";
  }
}
