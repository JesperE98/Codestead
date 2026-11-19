import { marked, type MarkedToken, type Token, type Tokens } from "marked";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { AnimatedImage } from "./AnimatedImage.js";

/** A fenced block of the markdown (```info … ```), for {@link MarkdownViewProps.customBlockRenderer}. */
export interface FencedBlock {
  /** The first word of the info string ("quiz", "sh" …). */
  info: string;
  /** The lines inside, without the last line break. */
  text: string;
}

export interface MarkdownViewProps {
  /** The markdown (already preprocessed: placeholders filled in, distro blocks resolved). */
  markdown: string;
  /** Called when a line in a ```sh block is clicked. */
  onCommandClicked?: (command: string) => void;
  /** Called when a link is clicked (the app opens it in the browser); without it the view opens web links itself. */
  onLinkClicked?: (url: string) => void;
  /** Tooltip on clickable command lines. */
  commandHint?: string;
  /** Optional renderer for custom fenced blocks (e.g. ```quiz). Return null to use the default rendering. */
  customBlockRenderer?: (block: FencedBlock) => ReactNode | null | undefined;
  /** The text size in pixels (16). */
  baseFontSize?: number;
  /**
   * Reads a picture of the text (`![alt](images/name.webp "caption")` alone in a paragraph): its bytes (or a URL), or
   * null when there is none (the picture is then left out). Without it pictures are not shown.
   */
  imageSource?: (path: string) => Uint8Array | string | null | undefined;
  /** Tooltip on animations (a click pauses them). */
  animationHint?: string;
  /** Writing direction of the text ("ltr" or "rtl"); code is always left to right. */
  dir?: "ltr" | "rtl";
  className?: string;
}

/**
 * Opens a web link in the browser when nobody listens to onLinkClicked (task texts, hints, quiz questions, What's
 * new): only http and https. The Electron apps can replace it (e.g. with shell.openExternal through the preload).
 */
export const LinkOpener = {
  open: (url: string): void => {
    let uri: URL;
    try {
      uri = new URL(url);
    } catch {
      return;
    }
    if (uri.protocol !== "https:" && uri.protocol !== "http:") return;
    globalThis.open?.(uri.href, "_blank", "noopener,noreferrer");
  },
};

const distroOpen = /<div class="distro-block" data-family="(\w+)" data-label="([^"]*)">/;
const detailsOpen = /^<details data-summary="([^"]*)">$/;

const familyColors: Readonly<Record<string, string>> = {
  debian: "#c7254e",
  arch: "#1793d1",
  redhat: "#3c6eb4",
};

const namedEntities: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decodes HTML entities (&amp;amp; &amp;copy; &amp;#8594; …) the way Markdig does (WebUtility.HtmlDecode for attributes). */
export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  const doc = globalThis.document;
  if (doc) {
    // A textarea's content is text: nothing in it becomes an element.
    const area = doc.createElement("textarea");
    area.innerHTML = text;
    return area.value;
  }
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return namedEntities[e.toLowerCase()] ?? whole;
  });
}

/** The top-level blocks, with distro blocks and folded blocks as containers (C#'s stack of panels). */
type Item =
  | { kind: "block"; token: MarkedToken }
  | { kind: "distro"; family: string; label: string; children: Item[] }
  | { kind: "details"; summary: string; children: Item[] };

function structure(tokens: readonly Token[]): Item[] {
  const root: Item[] = [];
  const stack: Item[][] = [root];
  const top = () => stack[stack.length - 1]!;
  for (const raw of tokens) {
    const token = raw as MarkedToken;
    if (token.type === "html") {
      const text = token.text;
      const open = distroOpen.exec(text);
      if (open) {
        const box: Item = { kind: "distro", family: open[1]!, label: open[2]!, children: [] };
        top().push(box);
        stack.push(box.children);
        continue;
      }
      const details = detailsOpen.exec(text.trim());
      if (details) {
        const box: Item = { kind: "details", summary: decodeEntities(details[1]!), children: [] };
        top().push(box);
        stack.push(box.children);
        continue;
      }
      if ((text.trim() === "</div>" || text.trim() === "</details>") && stack.length > 1) {
        stack.pop();
        continue;
      }
      continue; // other raw HTML is not shown
    }
    top().push({ kind: "block", token });
  }
  return root;
}

/** A folded block: a button with the summary that shows or hides what is inside. */
function Details({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cs-md-details cs-stack">
      <button type="button" className="flat cs-md-details-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="cs-md-details-arrow">{open ? "▾" : "▸"}</span>
        <span className="cs-md-details-summary">{summary}</span>
      </button>
      <div className="cs-md-stack" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/**
 * Renders chapter markdown as React elements: headings, paragraphs, lists, tables, block quotes, code blocks (```sh
 * lines are clickable commands), pictures, distro blocks (`<div class="distro-block" data-label="…">` …
 * `</div>`) and folded blocks (`<details data-summary="…">` … `</details>`: hidden until the summary is clicked, e.g. a
 * finished file the learner can look at when stuck). Both need a blank line after the opening and before the closing
 * tag. Raw HTML is never shown.
 */
export function MarkdownView(props: MarkdownViewProps) {
  const { markdown, baseFontSize = 16, dir, className } = props;
  const tokens = useMemo(() => marked.lexer(markdown, { gfm: true }), [markdown]);
  const items = useMemo(() => structure(tokens), [tokens]);
  const r = new Renderer(props);
  return (
    <div className={"cs-markdown" + (className ? " " + className : "")} dir={dir} style={{ "--md-base": `${baseFontSize}px` } as CSSProperties}>
      {r.items(items)}
    </div>
  );
}

/** Turns the tokens into elements (one per render, so that a custom renderer sees the blocks in order). */
class Renderer {
  constructor(private readonly p: MarkdownViewProps) {}

  items(items: readonly Item[]): ReactNode[] {
    return items.map((item, i) => {
      switch (item.kind) {
        case "distro":
          return (
            <div key={i} className="cs-md-distro cs-stack">
              <span className="cs-md-distro-badge" style={{ background: familyColors[item.family] ?? "#555555" }}>
                {item.label}
              </span>
              <div className="cs-md-stack">{this.items(item.children)}</div>
            </div>
          );
        case "details":
          return (
            <Details key={i} summary={item.summary}>
              {this.items(item.children)}
            </Details>
          );
        default:
          return <Block key={i}>{this.block(item.token)}</Block>;
      }
    });
  }

  block(t: MarkedToken): ReactNode {
    switch (t.type) {
      case "heading": {
        const level = t.depth <= 1 ? 1 : t.depth === 2 ? 2 : 3;
        const Tag = `h${Math.min(6, Math.max(1, t.depth))}` as "h1";
        return <Tag className={`cs-md-text cs-md-h cs-md-h${level}`}>{this.inlines(t.tokens)}</Tag>;
      }
      case "paragraph": {
        const picture = soleImage(t);
        if (picture) return this.picture(picture);
        return <p className="cs-md-text cs-md-p">{this.inlines(t.tokens)}</p>;
      }
      case "text":
        return <p className="cs-md-text cs-md-p">{t.tokens ? this.inlines(t.tokens) : decodeEntities(t.text)}</p>;
      case "list":
        return this.list(t);
      case "code": {
        const text = t.text.replace(/[\r\n]+$/, "");
        if (t.codeBlockStyle !== "indented") {
          const info = (t.lang ?? "").trim().split(/\s+/)[0] ?? "";
          const custom = this.p.customBlockRenderer?.({ info, text });
          if (custom != null) return custom;
          if (info === "sh" || info === "bash" || info === "shell") return this.commandBlock(text);
        }
        return this.codeBlock(text);
      }
      case "blockquote":
        return <div className="cs-md-quote cs-md-stack">{t.tokens.map((c, i) => <Block key={i}>{this.block(c as MarkedToken)}</Block>)}</div>;
      case "table":
        return this.table(t);
      case "hr":
        return <hr className="cs-md-hr" />;
      default:
        return null; // spaces, link definitions
    }
  }

  /** A picture with its caption (the title), or nothing when it cannot be read. */
  private picture(link: Tokens.Image): ReactNode {
    const source = this.p.imageSource?.(link.href);
    if (source == null || (typeof source !== "string" && source.length === 0)) return null;
    const alt = decodeEntities(link.text);
    return (
      <div className="cs-md-picture">
        <AnimatedImage source={source} alt={alt} hint={this.p.animationHint} />
        {link.title ? <span className="cs-md-caption">{link.title}</span> : null}
      </div>
    );
  }

  private list(list: Tokens.List): ReactNode {
    let number = typeof list.start === "number" ? list.start : 1;
    return (
      <div className="cs-md-list" role="list">
        {list.items.map((item, i) => (
          <div key={i} className="cs-md-item" role="listitem">
            <span className="cs-md-marker">{list.ordered ? `${number++}.` : "•"}</span>
            <div className="cs-md-stack">
              {item.tokens.map((child, j) => {
                const c = child as MarkedToken;
                // A paragraph in a list item is tight: no margins.
                if (c.type === "paragraph" || c.type === "text")
                  return (
                    <p key={j} className="cs-md-text">
                      {"tokens" in c && c.tokens ? this.inlines(c.tokens) : decodeEntities(c.text)}
                    </p>
                  );
                return <Block key={j}>{this.block(c)}</Block>;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  private table(table: Tokens.Table): ReactNode {
    const columns = table.header.length;
    const cell = (c: Tokens.TableCell, header: boolean, key: number) => {
      const content = this.inlines(c.tokens);
      return header ? <th key={key}>{content}</th> : <td key={key}>{content}</td>;
    };
    return (
      <div className="cs-md-table-scroll">
        <table className="cs-md-table">
          <thead>
            <tr>{table.header.map((c, i) => cell(c, true, i))}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>{row.slice(0, Math.max(1, columns)).map((c, i) => cell(c, false, i))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  private codeBlock(code: string): ReactNode {
    return (
      <div className="cs-md-code" dir="ltr">
        <pre>{code}</pre>
      </div>
    );
  }

  /** A ```sh block: every line is a button that puts the command in the terminal. */
  private commandBlock(code: string): ReactNode {
    const { onCommandClicked, commandHint } = this.p;
    return (
      <div className="cs-md-commands" dir="ltr">
        {code.split("\n").map((line, i) => {
          const text = line.replace(/\r+$/, "");
          return (
            <button key={i} type="button" className="cmd" title={commandHint || undefined} onClick={() => onCommandClicked?.(text)}>
              <span className="prompt">$ </span>
              {text}
            </button>
          );
        })}
      </div>
    );
  }

  inlines(tokens: readonly Token[] | undefined): ReactNode[] {
    return (tokens ?? []).map((t, i) => this.inline(t as MarkedToken, i));
  }

  private inline(t: MarkedToken, key: number): ReactNode {
    switch (t.type) {
      case "text":
        // A soft line break is a space.
        return t.tokens ? <span key={key}>{this.inlines(t.tokens)}</span> : decodeEntities(t.text).replaceAll("\n", " ");
      case "escape":
        return t.text;
      case "strong":
        return <strong key={key}>{this.inlines(t.tokens)}</strong>;
      case "em":
        return <em key={key}>{this.inlines(t.tokens)}</em>;
      case "del":
        return <s key={key}>{this.inlines(t.tokens)}</s>;
      case "codespan":
        return (
          <code key={key} className="cs-md-inline-code">
            {t.text}
          </code>
        );
      case "link": {
        // The link's text: its plain text and code (as Markdig's literal and code inlines).
        const text = t.tokens
          .map((c) => {
            const x = c as MarkedToken;
            return x.type === "text" ? decodeEntities(x.text) : x.type === "escape" || x.type === "codespan" ? x.text : "";
          })
          .join("");
        return this.link(text, t.href, key);
      }
      case "image":
        // A picture inside a line shows its text.
        return decodeEntities(t.text);
      case "br":
        return <br key={key} />;
      default:
        return null; // inline HTML
    }
  }

  private link(text: string, url: string, key: number): ReactNode {
    const { onLinkClicked } = this.p;
    return (
      <a
        key={key}
        className="cs-md-link"
        href={url}
        title={url}
        onClick={(e) => {
          e.preventDefault();
          if (e.button !== 0) return;
          if (onLinkClicked) onLinkClicked(url);
          else LinkOpener.open(url);
        }}
      >
        {text}
      </a>
    );
  }
}

/** One rendered block (nothing when the block renders as nothing). */
function Block({ children }: { children: ReactNode }) {
  return children ?? null;
}

/** A paragraph that is nothing but one picture. */
function soleImage(p: Tokens.Paragraph): Tokens.Image | null {
  const items = p.tokens.filter((t) => {
    const x = t as MarkedToken;
    return !(x.type === "text" && x.text.trim() === "") && x.type !== "br";
  });
  const only = items.length === 1 ? (items[0] as MarkedToken) : null;
  return only?.type === "image" ? only : null;
}
