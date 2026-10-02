/**
 * Removes the stored (cached) result from every formula cell in rows
 * firstRow..lastRow of a sheet's XML. The formulas stay, so Excel still
 * recalculates real values on open (the export also sets fullCalcOnLoad) —
 * but viewers that do not recalculate, such as phone previews, no longer show
 * the numbers the bundled template was saved with (another class's totals).
 */
export function stripCachedFormulaValues(xml: string, firstRow: number, lastRow: number): string {
  return xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*[^/]>[\s\S]*?<\/row>/g, (rowXml: string, rowNum: string) => {
    const r = Number(rowNum);
    if (r < firstRow || r > lastRow) return rowXml;
    return rowXml.replace(/(<c\b[^>]*[^/]>)([\s\S]*?)(<\/c>)/g, (cell: string, open: string, inner: string, close: string) => {
      if (!/<f[\s>/]/.test(inner)) return cell;
      return open + inner.replace(/<v>[\s\S]*?<\/v>|<v\/>/g, '') + close;
    });
  });
}
