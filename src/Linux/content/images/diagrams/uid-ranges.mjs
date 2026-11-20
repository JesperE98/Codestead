// Users and groups: the three ranges of UIDs (0 root, 1–999 system users, 1000 and up people) with the users the
// simulator's /etc/passwd really has in each – the learner's own user marked, and kim, whom the chapter creates, as the
// next one (dashed). nobody (65534), the special user the text mentions, greyed at the end.
import { C, PAD, W, box, code, isRtl, label, perLanguage, svg, tr } from "./style.mjs";
import { flow } from "./_admin.mjs";

export const variants = perLanguage("uid-ranges");

export const words = {
  root: { en: "the administrator", sv: "administratören", de: "der Administrator", fr: "l'administrateur", es: "el administrador", pt: "o administrador", ru: "администратор", zh: "管理员", ja: "管理者", ar: "المدير", hi: "administrator" },
  // A line break (\n) where the words do not fit on one line.
  system: { en: "system users", sv: "systemanvändare", de: "Systembenutzer", fr: "utilisateurs système", es: "usuarios del sistema", pt: "usuários de sistema", ru: "системные\nпользователи", zh: "系统用户", ja: "システムユーザー", ar: "مستخدمو النظام", hi: "system users" },
  regular: { en: "regular users", sv: "vanliga användare", de: "normale Benutzer", fr: "utilisateurs\nordinaires", es: "usuarios normales", pt: "usuários comuns", ru: "обычные\nпользователи", zh: "普通用户", ja: "一般ユーザー", ar: "المستخدمون العاديون", hi: "सामान्य users" },
  people: { en: "people", sv: "människor", de: "Menschen", fr: "des personnes", es: "personas", pt: "pessoas", ru: "люди", zh: "也就是人", ja: "人間", ar: "البشر", hi: "इंसान" },
};

export const terminals = { passwd: { commands: ["awk -F: '{print $3, $1}' /etc/passwd"] } };

const HEAD_W = 214; // the range and its word
const GAP = 16;

function users(R) {
  return R.passwd.lines[0].output.map((row) => row.map((r) => r.text).join("").split(" ")).map(([uid, name]) => ({ uid: Number(uid), name }));
}

function rows(v, R) {
  const all = users(R);
  const me = all.find((u) => u.uid === 1000);
  const nobody = all.find((u) => u.name === "nobody");
  const chips = (list) => list.map((u) => ({ s: `${u.uid} ${u.name}` }));
  return [
    { range: "0", word: "root", style: "x", color: C.x, items: chips(all.filter((u) => u.uid === 0)) },
    { range: "1–999", word: "system", style: "z", color: C.z, items: chips(all.filter((u) => u.uid > 0 && u.uid < 1000).sort((a, b) => a.uid - b.uid)) },
    {
      range: "≥ 1000",
      word: "regular",
      style: "y",
      color: C.y,
      items: [{ s: `${me.uid} ${me.name}`, style: "accent" }, { s: "1001 kim", style: "muted" }, { s: `${nobody.uid} ${nobody.name}`, style: "grey" }],
    },
  ];
}

const layout = (v, R) => {
  const rtl = isRtl(v);
  const x0 = rtl ? PAD : PAD + HEAD_W + GAP, x1 = rtl ? W - PAD - HEAD_W - GAP : W - PAD;
  let y = PAD;
  return rows(v, R).map((r) => {
    const f = flow(r.items, x0 + 14, x1 - 14, 0, { rtl });
    const h = Math.max(92, f.height + 30);
    const row = { ...r, y, h, x0, x1 };
    y += h + 14;
    return row;
  });
};

export const height = (v, R) => {
  const l = layout(v, R).at(-1);
  return l.y + l.h + PAD;
};

export function draw(v, R) {
  const rtl = isRtl(v);
  let s = "";
  for (const r of layout(v, R)) {
    const hx = rtl ? W - PAD - HEAD_W : PAD;
    // The range: its numbers and its word, in the range's colour.
    s += box(hx, r.y, HEAD_W, r.h, { style: r.style });
    // The range on top, then the word (and, for people, who they are) – the whole block centred in the row.
    const lines = [...tr(v, words[r.word]).split("\n").map((t) => [t, C.ink, 600]), ...(r.word === "regular" ? [[tr(v, words.people), C.muted, 500]] : [])];
    const top = r.y + r.h / 2 - (36 + lines.length * 24) / 2;
    s += code(hx + HEAD_W / 2, top + 16, r.range, { anchor: "middle", size: 26, weight: 700, color: r.color });
    lines.forEach(([t, color, weight], i) => (s += label(v, hx + HEAD_W / 2, top + 48 + i * 24, t, { anchor: "middle", weight, color, fit: HEAD_W - 12 })));
    // The users in it.
    s += box(r.x0, r.y, r.x1 - r.x0, r.h, { style: "plain" });
    const rowsHeight = flow(r.items, r.x0 + 14, r.x1 - 14, 0, { rtl }).height - 46;
    s += flow(r.items, r.x0 + 14, r.x1 - 14, r.y + r.h / 2 - rowsHeight / 2, { rtl }).svg;
  }
  return svg(height(v, R), s);
}
