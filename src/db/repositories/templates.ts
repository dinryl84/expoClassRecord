import { getDb } from '../client';
import type { TemplateRow } from '@/types';

export function getAllTemplates(): TemplateRow[] {
  return getDb().getAllSync<TemplateRow>('SELECT * FROM templates ORDER BY updatedAt DESC');
}

export function getTemplate(id: string): TemplateRow | null {
  return getDb().getFirstSync<TemplateRow>('SELECT * FROM templates WHERE id = ?', id);
}

export function putTemplate(template: TemplateRow) {
  getDb().runSync(
    'INSERT OR REPLACE INTO templates (id, name, data, updatedAt) VALUES (?, ?, ?, ?)',
    template.id,
    template.name,
    template.data,
    template.updatedAt
  );
}

export function deleteTemplate(id: string) {
  getDb().runSync('DELETE FROM templates WHERE id = ?', id);
}

export function replaceAllTemplates(templates: TemplateRow[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllTemplatesRaw(templates));
}

/** Same as replaceAllTemplates but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllTemplatesRaw(templates: TemplateRow[]) {
  const db = getDb();
  db.execSync('DELETE FROM templates;');
  for (const t of templates) putTemplate(t);
}
