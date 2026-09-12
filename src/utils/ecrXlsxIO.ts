import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Workbook structure (sheet name -> path, shared strings)
// ---------------------------------------------------------------------------

export async function loadZipFromBase64(base64: string): Promise<JSZip> {
  return JSZip.loadAsync(base64, { base64: true });
}

export async function zipToBase64(zip: JSZip): Promise<string> {
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}

export async function getSheetPathMap(zip: JSZip): Promise<Record<string, string>> {
  const wbFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!wbFile || !relsFile) return {};
  const wbXml = await wbFile.async('string');
  const relsXml = await relsFile.async('string');

  const ridToTarget: Record<string, string> = {};
  const relRe = /Id="(rId\d+)"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="(rId\d+)"/gi;
  let rm;
  while ((rm = relRe.exec(relsXml))) {
    ridToTarget[rm[1] || rm[4]] = (rm[2] || rm[3]).replace(/^\//, '');
  }

  const map: Record<string, string> = {};
  const sheetRe = /<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"|<sheet[^>]*r:id="(rId\d+)"[^>]*name="([^"]+)"/gi;
  let sm;
  while ((sm = sheetRe.exec(wbXml))) {
    const name = sm[1] || sm[4];
    const rid = sm[2] || sm[3];
    let target = ridToTarget[rid] || '';
    if (target && !target.startsWith('xl/')) {
      target = 'xl/' + target.replace(/^\.\//, '');
    }
    if (name && target) map[name] = target;
  }
  return map;
}

export function findPath(pathMap: Record<string, string>, ...names: string[]): string | null {
  for (const n of names) {
    for (const [name, path] of Object.entries(pathMap)) {
      if (name.toUpperCase() === n.toUpperCase()) return path;
    }
  }
  for (const n of names) {
    for (const [name, path] of Object.entries(pathMap)) {
      if (name.toUpperCase().includes(n.toUpperCase())) return path;
    }
  }
  return null;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

/** Concatenates all <t> runs within one <si> element (handles rich text). */
function extractSiText(si: string): string {
  const parts: string[] = [];
  const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = tRe.exec(si))) parts.push(unescapeXml(m[1]));
  return parts.join('');
}

export async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const xml = await file.async('string');
  const strings: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) strings.push(extractSiText(m[1]));
  return strings;
}

// ---------------------------------------------------------------------------
// Cell read
// ---------------------------------------------------------------------------

function cellRegex(ref: string): RegExp {
  return new RegExp(`<c(\\s[^>]*?\\br="${ref}"[^>]*?)(?:/>|>([\\s\\S]*?)</c>)`, 'i');
}

/**
 * Reads one cell's raw value from a sheet's XML.
 * - t="s"        -> shared string (resolve index into sharedStrings[])
 * - t="inlineStr"-> inline <is><t>...</t></is>
 * - t="str"      -> formula string result, value is in <v>
 * - no t / "n"   -> numeric <v> (also used for cached formula results)
 * Returns null for empty/missing cells.
 */
export function getCellValue(sheetXml: string, ref: string, sharedStrings: string[]): string | number | null {
  const m = sheetXml.match(cellRegex(ref));
  if (!m) return null;
  const attrs = m[1] || '';
  const inner = m[2] || '';

  const typeMatch = attrs.match(/\bt="([a-zA-Z]+)"/);
  const type = typeMatch ? typeMatch[1] : null;

  if (type === 'inlineStr') {
    const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    return tMatch ? unescapeXml(tMatch[1]) : null;
  }

  const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
  if (!vMatch) return null;
  const raw = vMatch[1];

  if (type === 's') {
    const idx = Number(raw);
    return Number.isFinite(idx) ? sharedStrings[idx] ?? null : null;
  }
  if (type === 'str' || type === 'b') {
    return unescapeXml(raw);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : unescapeXml(raw);
}

// ---------------------------------------------------------------------------
// Cell write — style-preserving patcher, ported verbatim from the PWA
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractStyle(attrs: string): string {
  const m = attrs.match(/\bs="(\d+)"/);
  return m ? ` s="${m[1]}"` : '';
}

/** Converts a column letter (A, B, ..., Z, AA, AB, ...) to a 1-based number, for ordering comparisons. */
function colToNum(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n;
}

/** Inserts `newCellXml` into a row's inner XML in ascending column order (spec-conformant, not just appended). */
function insertCellInOrder(rowInner: string, col: string, newCellXml: string): string {
  const targetCol = colToNum(col);
  const cellRe = /<c\s[^>]*\br="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(rowInner))) {
    if (colToNum(m[1]) > targetCol) {
      return rowInner.slice(0, m.index) + newCellXml + rowInner.slice(m.index);
    }
  }
  return rowInner + newCellXml;
}

/** Inserts a whole `<row>...</row>` block into sheetData in ascending row-number order. */
function insertRowInOrder(xml: string, rowNum: string, newRowXml: string): string {
  const targetRow = Number(rowNum);
  const rowOpenRe = /<row[^>]*\br="(\d+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = rowOpenRe.exec(xml))) {
    if (Number(m[1]) > targetRow) {
      return xml.slice(0, m.index) + newRowXml + xml.slice(m.index);
    }
  }
  return xml.replace(/<\/sheetData>/i, `${newRowXml}</sheetData>`);
}

function buildCellXml(fullRef: string, value: string | number | null | undefined, styleAttr: string): string {
  if (value == null || value === '') return `<c r="${fullRef}"${styleAttr}/>`;
  if (typeof value === 'number') return `<c r="${fullRef}"${styleAttr}><v>${value}</v></c>`;
  return `<c r="${fullRef}"${styleAttr} t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
}

export function setSheetCell(xml: string, ref: string, value: string | number | null | undefined): string {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return xml;
  const col = m[1].toUpperCase();
  const rowNum = m[2];
  const fullRef = `${col}${rowNum}`;

  const cellRe = cellRegex(fullRef);
  const existing = xml.match(cellRe);
  const styleAttr = existing ? extractStyle(existing[1]) : '';
  const newCell = buildCellXml(fullRef, value, styleAttr);

  if (existing) return xml.replace(cellRe, newCell);

  const rowRe = new RegExp(`(<row[^>]*\\br="${rowNum}"[^>]*>)([\\s\\S]*?)(</row>)`, 'i');
  if (rowRe.test(xml)) {
    return xml.replace(rowRe, (_w, open: string, inner: string, close: string) => `${open}${insertCellInOrder(inner, col, newCell)}${close}`);
  }
  const newRowXml = `<row r="${rowNum}">${newCell}</row>`;
  return insertRowInOrder(xml, rowNum, newRowXml);
}

/**
 * Applies one row's worth of cell writes at once, scanning the full document
 * only once per row (not once per cell) — see setMany() for why this matters.
 */
function setRowCells(xml: string, rowNum: string, writes: { col: string; value: string | number | null | undefined }[]): string {
  const sorted = [...writes].sort((a, b) => colToNum(a.col) - colToNum(b.col));
  const rowRe = new RegExp(`(<row[^>]*\\br="${rowNum}"[^>]*>)([\\s\\S]*?)(</row>)`, 'i');
  const rowMatch = xml.match(rowRe);

  if (rowMatch) {
    // Row exists: patch its (small) inner XML in memory, then splice it back
    // in — every cell lookup below scans just this row, not the whole file.
    let inner = rowMatch[2];
    for (const w of sorted) {
      const fullRef = `${w.col}${rowNum}`;
      const cRe = cellRegex(fullRef);
      const existing = inner.match(cRe);
      const styleAttr = existing ? extractStyle(existing[1]) : '';
      const newCell = buildCellXml(fullRef, w.value, styleAttr);
      inner = existing ? inner.replace(cRe, newCell) : insertCellInOrder(inner, w.col, newCell);
    }
    const start = rowMatch.index!;
    return xml.slice(0, start) + rowMatch[1] + inner + rowMatch[3] + xml.slice(start + rowMatch[0].length);
  }

  // Row doesn't exist yet: build it whole and insert once.
  const inner = sorted.map((w) => buildCellXml(`${w.col}${rowNum}`, w.value, '')).join('');
  return insertRowInOrder(xml, rowNum, `<row r="${rowNum}">${inner}</row>`);
}

/**
 * Applies many cell writes to a sheet's XML.
 *
 * Writes are grouped by row first, so the full document is scanned once per
 * *row* rather than once per *cell* — a template export can touch 3,000+
 * cells across ~100 rows, and re-scanning the whole (often multi-MB) sheet
 * XML for every single cell is quadratic and freezes the JS thread on
 * device. Grouping by row keeps the expensive full-document scan down to
 * roughly the row count instead of the cell count.
 */
export function setMany(xml: string, cells: Record<string, string | number | null | undefined>): string {
  const byRow = new Map<string, { col: string; value: string | number | null | undefined }[]>();
  for (const [ref, value] of Object.entries(cells)) {
    const m = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!m) continue;
    const col = m[1].toUpperCase();
    const rowNum = m[2];
    const list = byRow.get(rowNum);
    if (list) list.push({ col, value });
    else byRow.set(rowNum, [{ col, value }]);
  }

  // Ascending row order so new-row inserts land in the right spot relative
  // to each other (insertRowInOrder only looks forward from where it is).
  const rowNums = [...byRow.keys()].sort((a, b) => Number(a) - Number(b));

  let out = xml;
  for (const rowNum of rowNums) {
    out = setRowCells(out, rowNum, byRow.get(rowNum)!);
  }
  return out;
}
