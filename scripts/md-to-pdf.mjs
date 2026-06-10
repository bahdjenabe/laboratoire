// Convertit un fichier Markdown en HTML stylé pour impression PDF.
// Usage : node scripts/md-to-pdf.mjs [chemin.md] [sortie.html]
// Par défaut : docs/CAHIER-DES-CHARGES.md → docs/CAHIER-DES-CHARGES.html
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const SRC = process.argv[2] ?? "docs/CAHIER-DES-CHARGES.md";
const OUT = process.argv[3] ?? SRC.replace(/\.md$/i, ".html");

const title =
  SRC.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "Document";

const body = marked.parse(readFileSync(SRC, "utf8"));

const css = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b; line-height: 1.55; font-size: 12px; margin: 0;
  }
  h1 { font-size: 24px; color: #065f46; border-bottom: 3px solid #10b981;
       padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 18px; color: #0f172a; margin-top: 28px;
       border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 14px; color: #334155; margin-top: 18px; }
  h2, h3 { page-break-after: avoid; }
  p, li { font-size: 12px; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px;
         font-family: "Consolas", "Courier New", monospace; font-size: 11px; }
  pre { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 8px;
        overflow-x: auto; font-size: 11px; page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0;
          font-size: 11px; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 9px; text-align: left;
           vertical-align: top; }
  th { background: #f0fdf4; color: #065f46; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote { border-left: 4px solid #10b981; background: #f0fdf4;
               margin: 10px 0; padding: 8px 14px; color: #475569;
               border-radius: 0 6px 6px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 22px 0; }
  a { color: #059669; text-decoration: none; }
  strong { color: #0f172a; }
`;

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${title} — LabMédical</title>
<style>${css}</style></head>
<body>${body}</body></html>`;

writeFileSync(OUT, html);
console.log("HTML généré :", OUT);
