import { HttpRequestError, messageOf } from "./Errors.js";

// The hub's network access (C#: the HttpClient that MainWindow creates and passes in, so the tests and the hub can use
// different ones). Electron's main process gives it net.fetch, which uses the system's proxy settings like .NET does.

/** What the hub needs from an HttpClient. */
export interface HttpClient {
  /** HttpClient.GetByteArrayAsync: the whole response; an error status throws {@link HttpRequestError}. */
  getBytes(url: string): Promise<Uint8Array>;
  /** HttpClient.GetStreamAsync: the response body as it arrives. */
  getStream(url: string): Promise<AsyncIterable<Uint8Array>>;
}

/** The part of fetch() the client uses (global fetch, or Electron's net.fetch). */
export type FetchLike = (url: string, init: { signal: AbortSignal; redirect: "follow" }) => Promise<Response>;

/**
 * An HttpClient over fetch with HttpClient.Timeout's meaning: the time until the whole response has been read
 * (getBytes), or until its headers have arrived (getStream, like ResponseHeadersRead).
 */
export function fetchHttpClient(fetchFn: FetchLike, timeoutMs = 100_000): HttpClient {
  const timeoutMessage = `The request was canceled due to the configured HttpClient.Timeout of ${timeoutMs / 1000} seconds elapsing.`;

  async function send(url: string, controller: AbortController): Promise<Response> {
    let response: Response;
    try {
      response = await fetchFn(url, { signal: controller.signal, redirect: "follow" });
    } catch (e) {
      throw controller.signal.aborted ? new HttpRequestError(timeoutMessage, undefined, { cause: e }) : networkError(e);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new HttpRequestError(`Response status code does not indicate success: ${response.status} (${response.statusText}).`, response.status);
    }
    return response;
  }

  return {
    async getBytes(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await send(url, controller);
        try {
          return new Uint8Array(await response.arrayBuffer());
        } catch (e) {
          throw controller.signal.aborted ? new HttpRequestError(timeoutMessage, undefined, { cause: e }) : networkError(e);
        }
      } finally {
        clearTimeout(timer);
      }
    },

    async getStream(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await send(url, controller);
      } finally {
        clearTimeout(timer);
      }
      const body = response.body;
      return {
        async *[Symbol.asyncIterator]() {
          if (!body) return;
          const reader = body.getReader();
          try {
            for (;;) {
              let chunk: ReadableStreamReadResult<Uint8Array>;
              try {
                chunk = await reader.read();
              } catch (e) {
                throw networkError(e);
              }
              if (chunk.done) return;
              yield chunk.value;
            }
          } finally {
            reader.releaseLock();
          }
        },
      };
    },
  };
}

/** fetch's "fetch failed" with the real reason in its cause, as .NET's HttpRequestException message. */
function networkError(e: unknown): HttpRequestError {
  const cause = e instanceof Error && e.cause !== undefined ? messageOf(e.cause) : messageOf(e);
  return new HttpRequestError(cause, undefined, { cause: e });
}
