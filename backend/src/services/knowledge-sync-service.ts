type Locale = 'zh-CN' | 'en-US';

function normalizeLocale(input: unknown): Locale {
  if (typeof input === 'string' && (['zh-CN', 'en-US'] as readonly string[]).includes(input)) {
    return input as Locale;
  }
  return 'zh-CN';
}

function buildSourceUrl(uid: string, record: any): string {
  const locale = normalizeLocale(record?.locale);
  const docId = record?.documentId || record?.id;
  return `strapi://${uid}/${docId}?locale=${locale}`;
}

const CONTENT_TYPES = [
  { uid: 'api::product.product', serialize: serializeProduct, name: '课程' },
  { uid: 'api::news-article.news-article', serialize: serializeNews, name: '新闻' },
  { uid: 'api::teacher.teacher', serialize: serializeTeacher, name: '教师' },
  { uid: 'api::campus.campus', serialize: serializeCampus, name: '校区' },
  { uid: 'api::faq-item.faq-item', serialize: serializeFaq, name: 'FAQ' },
];

export function serializeProduct(p: any): string {
  const lines: string[] = [];
  lines.push(`课程：${p.name || ''}`);
  if (p.shortDescription) {
    lines.push(`简介：${p.shortDescription}`);
  } else if (p.description) {
    lines.push(`简介：${p.description}`);
  }
  if (p.objectives && Array.isArray(p.objectives) && p.objectives.length > 0) {
    const objectives = p.objectives.map((o: any) => o.title || '').filter(Boolean).join(' | ');
    if (objectives) {
      lines.push(`教学目标：${objectives}`);
    }
  }
  if (p.teachingMethod) {
    lines.push(`教学方式：${p.teachingMethod}`);
  }
  if (p.price) {
    lines.push(`价格：${p.price}元`);
  }
  return lines.join('\n');
}

export function serializeNews(n: any): string {
  return `新闻：${n.title || ''}。${n.content || n.excerpt || ''}`;
}

export function serializeTeacher(t: any): string {
  return `教师：${t.name || ''}，${t.title || ''}。${t.bio || t.description || ''}`;
}

export function serializeCampus(c: any): string {
  return `校区：${c.name || ''}，地址${c.address || ''}，电话${c.phone || ''}。${c.description || ''}`;
}

export function serializeFaq(f: any): string {
  return `问题：${f.question || ''}。答案：${f.answer || ''}`;
}

export async function syncWebsiteContent(strapi: any): Promise<{ synced: number; updated: number; errors: string[] }> {
  let synced = 0;
  let updated = 0;
  const errors: string[] = [];
  const LOCALES: Locale[] = ['zh-CN', 'en-US'];

  for (const { uid, serialize, name } of CONTENT_TYPES) {
    for (const locale of LOCALES) {
      try {
        const records = await strapi.documents(uid).findMany({
          limit: 1000,
          locale,
        });
        for (const record of records) {
          const recordWithLocale = { ...record, locale };
          const sourceUrl = buildSourceUrl(uid, recordWithLocale);
          const content = serialize(record);

          const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
            where: { sourceUrl },
          });

          if (existing) {
            await strapi.documents('api::knowledge-base.knowledge-base').update({
              documentId: existing.documentId,
              data: { title: record.title || record.name || `${name}文档`, content, locale, status: 'pending' },
            });
            updated++;
          } else {
            await strapi.documents('api::knowledge-base.knowledge-base').create({
              data: {
                title: record.title || record.name || `${name}文档`,
                content,
                sourceType: 'content-sync',
                sourceUrl,
                locale,
                status: 'pending',
                priority: 'high',
                tags: name,
              },
            });
            synced++;
          }
        }
      } catch (err) {
        errors.push(`${name}[${locale}]: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`[knowledge-sync-service] Sync complete: ${synced} new, ${updated} updated, ${errors.length} errors`);
  return { synced, updated, errors };
}

export async function syncSingleContent(strapi: any, uid: string, record: any): Promise<void> {
  const config = CONTENT_TYPES.find(c => c.uid === uid);
  if (!config) return;

  const locale = normalizeLocale(record?.locale);
  const sourceUrl = buildSourceUrl(uid, record);
  const content = config.serialize(record);

  const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
    where: { sourceUrl },
  });

  if (existing) {
    await strapi.documents('api::knowledge-base.knowledge-base').update({
      documentId: existing.documentId,
      data: { title: record.title || record.name || '文档', content, locale, status: 'pending' },
    });
  } else {
    await strapi.documents('api::knowledge-base.knowledge-base').create({
      data: {
        title: record.title || record.name || '文档',
        content,
        sourceType: 'content-sync',
        sourceUrl,
        locale,
        status: 'pending',
        priority: 'high',
        tags: config.name,
      },
    });
  }
}

export async function deleteSyncedContent(strapi: any, uid: string, record: any): Promise<void> {
  const sourceUrl = buildSourceUrl(uid, record);
  const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
    where: { sourceUrl },
  });
  if (existing) {
    const kbService = strapi.service('api::knowledge-base.knowledge-base');
    await kbService.deleteVectors(existing.id);
    await strapi.documents('api::knowledge-base.knowledge-base').delete({
      documentId: existing.documentId,
    });
  }
}
