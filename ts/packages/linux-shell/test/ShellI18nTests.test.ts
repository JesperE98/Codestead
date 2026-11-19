// Port of tests/Linux/Codestead.Shell.Tests/ShellI18nTests.cs – the simulator's own texts in
// src/Linux/Codestead.Shell/i18n/<lang>.json (see ShellI18n).
//
// The summaries in en.json and sv.json are generated from CommandDef.summaryEn/summary. After changing a summary
// in the code, regenerate them with
//   CODESTEAD_UPDATE_SHELL_I18N=1 npx vitest run packages/linux-shell
// and translate the change in the other languages.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as IndexCmd from "../src/Commands/IndexCmd.js";
import * as ManEnCmd from "../src/Commands/Man/ManEnCmd.js";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import * as ShellI18n from "../src/ShellI18n.js";
import type { CommandDef } from "../src/Types/CommandDef.js";
import { allCommandNames, itNeeds, TestShell, whenCommands } from "./TestShell.js";

/** The app's languages (Codestead.Content/LanguagesLib.cs). */
const langCodes = ["en", "sv", "es", "zh", "hi", "ar", "pt", "fr", "de", "ru", "ja"];

/**
 * Texts that may be the same as the English ones in a language (lang → message keys, or "summary.<command>").
 * Empty today; add a key here only when the identical text is right (e.g. a message that is only a command).
 */
const sameAsEnglish = new Map<string, string[]>();

const placeholder = /\{([A-Za-z0-9_]+)\}/g;
const swedish = /[åäöÅÄÖ]/;
/** German has ä and ö of its own: look for å and common Swedish words instead. */
const swedishInGerman = /[åÅ]|(?<![\p{L}\p{Mn}\p{Nd}\p{Pc}])(och|inte|är|för|stöds|finns|simulatorn)(?![\p{L}\p{Mn}\p{Nd}\p{Pc}])/u;

/**
 * A message key passed as a string literal to msg or one of its wrappers
 * (dim, note, tip, dimNote, unsupported, feature – PascalCase in C#), optionally after one argument (sh, ctx, lang).
 */
const keyInCode = /\b(?:[Mm]sg|[Dd]im|[Nn]ote|[Tt]ip|[Dd]imNote|[Uu]nsupported|[Ff]eature)\(\s*(?:[A-Za-z_][\w.]*\s*,\s*)?"([a-z]+\.[A-Za-z0-9.]+)"/g;

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const i18nDir = join(repoRoot, "src", "Linux", "Codestead.Shell", "i18n");
const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

const names = (text: string): Set<string> => new Set([...text.matchAll(placeholder)].map((m) => m[1]!));
const ordinalSort = (xs: Iterable<string>): string[] => [...xs].sort();

/** The commands help shows, with the summaries written in the code. */
function commands(): CommandDef[] {
  return [...IndexCmd.commands()]
    .filter(([k, v]) => v.name === k && !k.startsWith("__"))
    .map(([, v]) => v)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function writeSummaries(lang: string, summaries: Map<string, string>): void {
  const path = join(i18nDir, `${lang}.json`);
  const root = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const obj: Record<string, string> = {};
  for (const name of ordinalSort(summaries.keys())) obj[name] = summaries.get(name)!;
  root["summaries"] = obj;
  writeFileSync(path, JSON.stringify(root, null, 2) + "\n");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("ShellI18nTests", () => {
  it("det finns en fil för varje språk", () => {
    expect(ordinalSort(ShellI18n.languages())).toEqual(ordinalSort(langCodes));
  });

  it.each(langCodes)("samma nycklar och platshållare som engelskan (%s)", (lang) => {
    const en = ShellI18n.messages("en");
    const msgs = ShellI18n.messages(lang);
    expect(ordinalSort(msgs.keys())).toEqual(ordinalSort(en.keys()));
    for (const [key, text] of en) {
      const a = names(text);
      const b = names(msgs.get(key)!);
      expect(a.size === b.size && [...a].every((x) => b.has(x)), `${lang}/${key}: placeholders differ:\n${text}\n${msgs.get(key)}`).toBe(true);
      expect(msgs.get(key)!.trim() !== "", `${lang}/${key} is empty`).toBe(true);
    }
    expect(ordinalSort(ShellI18n.summaries(lang).keys())).toEqual(ordinalSort(ShellI18n.summaries("en").keys()));
    for (const [k, v] of ShellI18n.summaries(lang)) expect(v.trim() !== "", `${lang}/${k} is empty`).toBe(true);
  });

  it.each(langCodes)("inga svenska tecken och inget oöversatt (%s)", (lang) => {
    if (lang === "en") return;
    const allowed = sameAsEnglish.get(lang) ?? [];
    const texts = [
      ...[...ShellI18n.messages(lang)].map(([key, text]) => ({ key, text, en: ShellI18n.messages("en").get(key)! })),
      ...[...ShellI18n.summaries(lang)].map(([key, text]) => ({ key: "summary." + key, text, en: ShellI18n.summaries("en").get(key)! })),
    ];
    const sw = lang === "de" ? swedishInGerman : swedish;
    for (const { key, text, en } of texts) {
      if (lang !== "sv") expect(sw.test(text), `${lang}/${key}: leftover Swedish: ${text}`).toBe(false);
      if (!allowed.includes(key)) expect(text !== en, `${lang}/${key} is the same as the English text: ${text}`).toBe(true);
    }
  });

  itNeeds(allCommandNames(), "engelska och svenska sammanfattningar kommer från koden", () => {
    const expected = new Map<string, (d: CommandDef) => string>([
      ["en", ManEnCmd.englishSummary],
      ["sv", (d) => d.summary],
    ]);
    if (process.env["CODESTEAD_UPDATE_SHELL_I18N"] === "1") {
      for (const [lang, summary] of expected) writeSummaries(lang, new Map(commands().map((d) => [d.name, summary(d)])));
      return;
    }
    for (const [lang, summary] of expected) {
      const json = ShellI18n.summaries(lang);
      expect(ordinalSort(json.keys())).toEqual(commands().map((d) => d.name));
      for (const def of commands())
        expect(
          json.get(def.name) === summary(def),
          `${lang}.json: the summary of ${def.name} differs from the code. Run CODESTEAD_UPDATE_SHELL_I18N=1 npx vitest run packages/linux-shell`,
        ).toBe(true);
    }
  });

  it("varje nyckel i koden finns, och varje nyckel används", () => {
    const used = new Set<string>();
    for (const f of sourceFiles(srcDir)) for (const m of readFileSync(f, "utf8").matchAll(keyInCode)) used.add(m[1]!);
    const keys = new Set(ShellI18n.messages("en").keys());
    expect([...used].filter((k) => !keys.has(k))).toEqual([]);
    // Every key is used once all the commands are ported (most keys are the commands' tip lines).
    whenCommands(allCommandNames(), () => expect([...keys].filter((k) => !used.has(k))).toEqual([]));
  });

  itNeeds(["cd"], "en saknad nyckel eller ett okänt språk ger engelska", () => {
    expect(ShellI18n.msg("xx", "shell.internalError")).toBe(ShellI18n.msg("en", "shell.internalError"));
    expect(ShellI18n.msg("de", "no.such.key")).toBe("no.such.key");
    expect(ManEnCmd.summaryFor(IndexCmd.commands().get("cd")!, new TestShell("ubuntu", "xx").sh)).toBe(ShellI18n.summaries("en").get("cd"));
  });

  // ---------- the simulator speaks the student's language ----------

  itNeeds(["help", "exit", "man", "ls"], "tipsrader, välkomsttext och help på tyska", () => {
    const t = new TestShell("fedora", "de");
    const cowsay = t.run("cowsay hej").out;
    expect(cowsay).toContain("command not found"); // the imitated bash error stays English
    expect(cowsay).toContain("Tipp vom Simulator: Der Befehl ist im Paket '");
    expect(cowsay).toContain("Siehe das Kapitel über Paketverwaltung.");

    expect(UtilCmd.stripAnsi(t.sh.welcome())).toContain("Simuliertes Terminal (");
    expect(UtilCmd.stripAnsi(t.sh.welcome())).toContain("Gib 'help' ein");

    const help = t.run("help").out;
    expect(help).toContain("Befehle in diesem simulierten Terminal");
    expect(help).toContain("Wechselt das aktuelle Verzeichnis");
    expect(t.run("exit").out).toContain("Das ist ein simuliertes Terminal");

    // Man pages are not translated, like on a real system.
    const man = t.run("man ls").out;
    expect(man).toContain("DESCRIPTION");
  });

  itNeeds(["true"], "tal skrivs som i språket", () => {
    const loop = (lang: string): string => new TestShell("ubuntu", lang).run("while true; do true; done").out;
    expect(loop("de")).toContain("nach 20.000 Schritten");
    expect(loop("en")).toContain("after 20,000 steps");
    expect(loop("sv")).toContain("efter 20 000 steg");
  });

  it.each([
    ["es", "Terminal simulada"],
    ["zh", "模拟终端"],
    ["hi", "सिम्युलेटेड टर्मिनल"],
    ["ar", "طرفية محاكاة"],
    ["pt", "Terminal simulado"],
    ["fr", "Terminal simulé"],
    ["ru", "Симулированный терминал"],
    ["ja", "シミュレーションのターミナル"],
  ])("välkomsttexten på alla språk (%s)", (lang, expected) => {
    expect(UtilCmd.stripAnsi(new TestShell("ubuntu", lang).sh.welcome())).toContain(expected);
  });
});
