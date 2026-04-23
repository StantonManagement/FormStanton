import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFormById } from '@/lib/formsData';
import { formatFormForPrint } from '@/lib/formUtils';

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PRINT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Inter:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #1a1a1a;
  background: #fff;
  padding: 0.75in 0.75in 1in;
}

/* Letterhead */
.pf-letterhead {
  text-align: center;
  border-bottom: 2px solid #1a2744;
  padding-bottom: 14px;
  margin-bottom: 28px;
}
.pf-letterhead h1 {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 18pt;
  color: #1a2744;
  letter-spacing: 2px;
  margin-bottom: 4px;
}
.pf-letterhead p { font-size: 9.5pt; color: #5a5a5a; }

/* No-print bar */
.pf-noprint {
  background: #1a2744;
  color: #fff;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'Inter', Arial, sans-serif;
  font-size: 10pt;
  margin: -0.75in -0.75in 0.5in;
}
.pf-noprint button {
  background: #fff;
  color: #1a2744;
  border: none;
  padding: 6px 18px;
  font-weight: 600;
  font-size: 10pt;
  cursor: pointer;
  font-family: 'Inter', Arial, sans-serif;
}

/* Headers */
h2.pf-h2 {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 12pt;
  color: #1a2744;
  border-bottom: 1pt solid #c0c0c0;
  padding-bottom: 4px;
  margin-top: 24pt;
  margin-bottom: 10pt;
  page-break-after: avoid;
}
h3.pf-h3 {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 11pt;
  color: #2d3f5f;
  margin-top: 16pt;
  margin-bottom: 8pt;
  page-break-after: avoid;
}

/* Paragraphs */
p.pf-p { margin-bottom: 8pt; }

/* HR */
hr.pf-hr { border: none; border-top: 1pt solid #c8c8c8; margin: 16pt 0; }

/* Field blanks */
.pf-field {
  margin: 10pt 0;
  display: flex;
  align-items: baseline;
  gap: 6pt;
  page-break-inside: avoid;
}
.pf-field-blank {
  display: inline-block;
  flex: 1;
  border-bottom: 1.5pt solid #1a1a1a;
  min-height: 0.5in;
  min-width: 180pt;
}

/* Checkbox list rows */
.pf-cb-row {
  display: flex;
  align-items: flex-start;
  gap: 8pt;
  margin: 6pt 0;
  page-break-inside: avoid;
}
.pf-cb-box {
  display: inline-block;
  width: 14pt;
  height: 14pt;
  border: 1.5pt solid #1a1a1a;
  flex-shrink: 0;
  margin-top: 1pt;
}

/* Inline checkboxes */
.pf-cb-inline {
  display: inline-block;
  width: 12pt;
  height: 12pt;
  border: 1.25pt solid #1a1a1a;
  vertical-align: middle;
  margin: 0 2pt;
}

/* Plain list items */
.pf-list-item { margin: 4pt 0 4pt 16pt; }

/* Numbered lists */
ol.pf-ol { margin: 8pt 0 8pt 20pt; }
ol.pf-ol li { margin-bottom: 6pt; }

/* Tables */
table.pf-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12pt 0;
  font-size: 10pt;
  page-break-inside: avoid;
}
.pf-th {
  border: 1pt solid #1a1a1a;
  padding: 6pt 10pt;
  background: #f0f0f0;
  font-weight: 600;
  text-align: left;
  font-size: 9.5pt;
}
.pf-td {
  border: 1pt solid #1a1a1a;
  padding: 8pt 10pt;
  min-height: 0.4in;
  vertical-align: top;
}

/* Blockquotes */
.pf-blockquote {
  border-left: 3pt solid #666;
  padding: 8pt 12pt;
  margin: 12pt 0;
  background: #f5f5f5;
  font-size: 10.5pt;
  page-break-inside: avoid;
}

/* Italic */
em.pf-em { font-style: italic; }

/* Signature blocks */
.pf-sig-block {
  display: flex;
  gap: 36pt;
  margin-top: 28pt;
  margin-bottom: 16pt;
  page-break-inside: avoid;
}
.pf-sig-item { flex: 1; }
.pf-sig-date { width: 110pt; flex-shrink: 0; }
.pf-sig-line {
  border-bottom: 1.5pt solid #1a1a1a;
  min-height: 1in;
  width: 100%;
}
.pf-sig-label {
  font-size: 8.5pt;
  color: #555;
  margin-top: 4pt;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Office use */
.pf-office-use {
  border-top: 1.5pt dashed #aaa;
  margin-top: 20pt;
  padding-top: 10pt;
  font-size: 9.5pt;
  color: #555;
}

/* Template placeholders */
.placeholder {
  background: #fff8e0;
  border: 1pt dashed #aaa;
  padding: 0 4pt;
  font-size: 9pt;
  color: #888;
}

@media print {
  body { padding: 0; }
  .pf-noprint { display: none !important; }
  .pf-field-blank { min-height: 0.5in; }
  .pf-sig-line { min-height: 1in; }
}
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formId = parseInt(id, 10);

  if (isNaN(formId)) {
    return new NextResponse('Invalid form ID', { status: 400 });
  }

  // Try DB override first, fall back to static
  let title = '';
  let content = '';

  const { data: dbRow } = await supabaseAdmin
    .from('admin_forms_library')
    .select('title, content')
    .eq('form_id', formId)
    .eq('is_current', true)
    .maybeSingle();

  if (dbRow?.content) {
    title = (dbRow.title as string) ?? '';
    content = dbRow.content as string;
  } else {
    const staticForm = getFormById(formId);
    if (!staticForm?.content) {
      return new NextResponse('Form not found or has no printable content', { status: 404 });
    }
    title = staticForm.title;
    content = staticForm.content;
  }

  const body = formatFormForPrint(content);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeAttr(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="pf-noprint">
    <span>Stanton Management &mdash; ${escapeAttr(title)}</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="pf-letterhead">
    <h1>STANTON MANAGEMENT</h1>
    <p>421 Park Street, Hartford CT 06106 &nbsp;&middot;&nbsp; (860) 993-3401</p>
  </div>
  <div class="pf-body">
    ${body}
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
