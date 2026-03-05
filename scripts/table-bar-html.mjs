/**
 * Build HTML for a table-with-inline-bars visualization.
 * Each row shows: label | value | horizontal bar.
 * Print-ready styling with Times New Roman.
 *
 * @param {Array<{ name: string, value: number }>} rows - Sorted by value descending
 * @param {Object} opts - { barColor, labelHeader, valueHeader, width, rowHeight, font }
 * @returns {string} HTML string
 */
export function buildTableBarHtml(rows, opts = {}) {
  const {
    barColor = '#2563eb',
    labelHeader = 'State',
    valueHeader = 'Count',
    width = 975,
    rowHeight = 28,
    font = 'Times New Roman, Georgia, serif',
  } = opts;

  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  const barWidth = 220;
  const labelColWidth = 180;
  const valueColWidth = 55;
  const padding = 8;

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headerRow = `
<tr style="border-bottom:2px solid #333;font-weight:bold;font-size:14px;">
  <td style="padding:${padding}px;font-family:${font};">${esc(labelHeader)}</td>
  <td style="padding:${padding}px;text-align:right;font-family:${font};">${esc(valueHeader)}</td>
  <td style="padding:${padding}px;font-family:${font};width:${barWidth}px;"></td>
</tr>`;

  const dataRows = rows
    .map(
      (r) => {
        const pct = (r.value / maxVal) * 100;
        return `
<tr style="border-bottom:1px solid #e0e0e0;">
  <td style="padding:${padding}px;font-family:${font};font-size:13px;">${esc(r.name)}</td>
  <td style="padding:${padding}px;text-align:right;font-family:${font};font-size:13px;">${r.value}</td>
  <td style="padding:${padding}px;vertical-align:middle;">
    <div style="height:16px;background:#e0e0e0;border-radius:2px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${barColor};min-width:${r.value > 0 ? 4 : 0}px;"></div>
    </div>
  </td>
</tr>`;
      }
    )
    .join('');

  const tableHeight = rows.length * rowHeight + 50;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#fff;font-family:${font};">
<div id="table-bar" style="width:${width}px;padding:20px;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;color:#1a1a1a;">
<thead>${headerRow}</thead>
<tbody>${dataRows}</tbody>
</table>
</div>
</body></html>`;
}
