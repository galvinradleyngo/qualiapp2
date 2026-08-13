// Legacy-compatible "Word export": an HTML document served with the
// `application/msword` MIME type, which Word (and Google Docs/LibreOffice)
// opens directly — no real .docx generation needed. Ported from the legacy
// app's downloadWordDoc/buildApaTableHtml pattern so exported tables keep
// the same APA7-ish look (Table N heading, italic title, bordered cells,
// italic Note line).

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function downloadWordDoc(filename: string, bodyHtml: string, title = 'QualiApp export'): void {
  const html = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${bodyHtml}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TABLE_STYLE = 'border-collapse:collapse;width:100%;font-family:"Times New Roman",serif;font-size:12pt;margin-bottom:8pt;';
const CELL_STYLE = 'border:1px solid #000;padding:4px 8px;text-align:left;vertical-align:top;';

export function apaTableHtml(tableNumber: number, title: string, headers: string[], rows: string[][], note?: string): string {
  const headHtml = headers.map((h) => `<th style="${CELL_STYLE}">${escapeHtml(h)}</th>`).join('');
  const rowsHtml = rows
    .map((r) => `<tr>${r.map((c) => `<td style="${CELL_STYLE}">${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `
    <p style="font-family:'Times New Roman',serif;"><strong>Table ${tableNumber}</strong></p>
    <p style="font-family:'Times New Roman',serif;"><em>${escapeHtml(title)}</em></p>
    <table style="${TABLE_STYLE}"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
    ${note ? `<p style="font-family:'Times New Roman',serif;font-size:10pt;"><em>Note.</em> ${escapeHtml(note)}</p>` : ''}
    <p>&nbsp;</p>
  `;
}

export function apaFigureHtml(figureNumber: number, title: string, pngDataUrl: string, note?: string): string {
  return `
    <p style="font-family:'Times New Roman',serif;"><strong>Figure ${figureNumber}</strong></p>
    <p style="font-family:'Times New Roman',serif;"><em>${escapeHtml(title)}</em></p>
    <img src="${pngDataUrl}" style="max-width:100%;" />
    ${note ? `<p style="font-family:'Times New Roman',serif;font-size:10pt;"><em>Note.</em> ${escapeHtml(note)}</p>` : ''}
    <p>&nbsp;</p>
  `;
}
