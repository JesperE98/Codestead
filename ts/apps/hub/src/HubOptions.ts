import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Command line options. The catalog/key/install options are only honoured together with --smoke-test. */
export class HubOptions {
  /** --background: started at login – stay in the tray (or minimised) until the user opens the hub. */
  background = false;

  constructor(
    readonly smokeTest: boolean,
    readonly catalog: URL | null,
    readonly publicKeyFile: string | null,
    readonly install: string | null,
  ) {}

  /**
   * @param testMode The end-to-end tests (CODESTEAD_HUB_E2E=1): --catalog and --public-key are honoured without
   * --smoke-test too, so the tests can show the normal window with a catalog of their own and no network.
   */
  static parse(args: readonly string[], cwd: string = process.cwd(), testMode = false): HubOptions {
    const value = (name: string): string | null => {
      const i = args.indexOf(name);
      return i >= 0 && i + 1 < args.length ? args[i + 1]! : null;
    };
    const smoke = args.includes("--smoke-test");
    if (!smoke && !testMode) {
      const o = new HubOptions(false, null, null, null);
      o.background = args.includes("--background");
      return o;
    }
    const catalog = value("--catalog");
    const o = new HubOptions(smoke, catalog === null ? null : pathToFileURL(isAbsolute(catalog) ? catalog : resolve(cwd, catalog)), value("--public-key"), smoke ? value("--install") : null);
    if (!smoke) o.background = args.includes("--background");
    return o;
  }
}
