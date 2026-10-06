import PDFDocument from 'pdfkit';

export interface PdfSection { heading?: string; body?: string; table?: { head: string[]; rows: string[][] } }

const COLORS = { ink: '#0b0d17', accent: '#7c5cff', muted: '#6b7280', line: '#e5e7eb' };

/** Strips Markdown syntax into readable plain paragraphs for PDF output. */
export const markdownToPlain = (md: string): string =>
  md
    .replace(/```[\w-]*\n([\s\S]*?)```/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

export const renderPdf = (title: string, sections: PdfSection[], subtitle?: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title, Producer: 'Nexora' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 6).fill(COLORS.accent);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22).text(title, 56, 48);
    if (subtitle) doc.moveDown(0.2).font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(subtitle);
    doc.moveDown(0.8);
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).strokeColor(COLORS.line).stroke();
    doc.moveDown(0.8);

    for (const s of sections) {
      if (s.heading) doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(s.heading).moveDown(0.3);
      if (s.body) doc.font('Helvetica').fontSize(10.5).fillColor('#1f2937').text(s.body, { lineGap: 3 }).moveDown(0.8);
      if (s.table) {
        const w = (doc.page.width - 112) / s.table.head.length;
        const row = (cells: string[], bold: boolean) => {
          const y = doc.y;
          if (y > doc.page.height - 90) doc.addPage();
          const top = doc.y;
          let maxH = 0;
          cells.forEach((c, i) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(bold ? COLORS.ink : '#374151');
            const h = doc.heightOfString(c || '—', { width: w - 6 });
            maxH = Math.max(maxH, h);
            doc.text(c || '—', 56 + i * w, top, { width: w - 6 });
          });
          doc.y = top + maxH + 6;
          doc.moveTo(56, doc.y - 2).lineTo(doc.page.width - 56, doc.y - 2).strokeColor(COLORS.line).stroke();
        };
        row(s.table.head, true);
        s.table.rows.forEach((r) => row(r, false));
        doc.moveDown(0.8);
      }
    }

    const range = doc.bufferedPageRange();
    void range;
    doc.end();
  });
