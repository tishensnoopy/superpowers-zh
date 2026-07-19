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

export const CONTENT_TYPES = [
  { uid: 'api::product.product', serialize: serializeProduct, name: '课程' },
  { uid: 'api::news-article.news-article', serialize: serializeNews, name: '新闻' },
  { uid: 'api::teacher.teacher', serialize: serializeTeacher, name: '教师' },
  { uid: 'api::campus.campus', serialize: serializeCampus, name: '校区' },
  { uid: 'api::faq-item.faq-item', serialize: serializeFaq, name: 'FAQ' },
];

/** 生命周期订阅列表的单一事实来源——index.ts register 必须使用它，禁止另写 UID 列表 */
export const SYNCED_UIDS = CONTENT_TYPES.map((c) => c.uid);

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
  const lines: string[] = [];
  lines.push(`新闻：${n.title || ''}`);
  if (n.publishedAt) {
    const date = typeof n.publishedAt === 'string' ? n.publishedAt.split('T')[0] : '';
    if (date) {
      lines.push(`发布日期：${date}`);
    }
  }
  if (n.excerpt) {
    lines.push(`摘要：${n.excerpt}`);
  }
  if (n.content) {
    lines.push(n.content);
  }
  return lines.join('\n');
}

export function serializeTeacher(t: any): string {
  const lines: string[] = [];
  lines.push(`教师：${t.name || ''}`);
  if (t.title) {
    lines.push(`职称：${t.title}`);
  }
  if (t.teachingYears) {
    lines.push(`教龄：${t.teachingYears}年`);
  }
  if (t.education) {
    lines.push(`学历：${t.education}`);
  }
  if (t.teachingFeatures) {
    lines.push(`教学特色：${t.teachingFeatures}`);
  }
  if (t.achievements && Array.isArray(t.achievements) && t.achievements.length > 0) {
    lines.push(`成就：${t.achievements.join(' | ')}`);
  }
  if (t.bio || t.description) {
    lines.push(t.bio || t.description);
  }
  return lines.join('\n');
}

export function serializeCampus(c: any): string {
  const lines: string[] = [];
  lines.push(`校区：${c.name || ''}`);
  if (c.address) {
    lines.push(`地址：${c.address}`);
  }
  if (c.phone) {
    lines.push(`电话：${c.phone}`);
  }
  if (c.businessHours) {
    lines.push(`营业时间：${c.businessHours}`);
  }
  if (c.transportation) {
    lines.push(`交通：${c.transportation}`);
  }
  if (c.description) {
    lines.push(c.description);
  }
  return lines.join('\n');
}

export function serializeFaq(f: any): string {
  const lines: string[] = [];
  lines.push(`问题：${f.question || ''}`);
  if (f.answer) {
    lines.push(`答案：${f.answer}`);
  }
  if (f.category) {
    lines.push(`分类：${f.category}`);
  }
  return lines.join('\n');
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

/**
 * 以"该 documentId+locale 当前是否存在 published 版本"为唯一事实来源，对单条内容做 KB 对账。
 * - 有 published 版本 → upsert KB 文档（置回 pending 触发重向量化）
 * - 无 published 版本（草稿/取消发布/已删除）→ 删除 KB 文档并清向量
 * 生命周期三个钩子（afterCreate/afterUpdate/afterDelete）都调它，事件载荷不可信。
 */
export async function reconcileContent(strapi: any, uid: string, ref: { documentId?: string; locale?: string }): Promise<void> {
  const config = CONTENT_TYPES.find((c) => c.uid === uid);
  if (!config || !ref?.documentId) return;

  const locale = normalizeLocale(ref.locale);
  const sourceUrl = buildSourceUrl(uid, { documentId: ref.documentId, locale });

  const published = await strapi.documents(uid).findOne({
    documentId: ref.documentId,
    locale,
    status: 'published',
    populate: '*',
  });

  const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
    where: { sourceUrl },
  });

  if (!published) {
    if (existing) {
      const kbService = strapi.service('api::knowledge-base.knowledge-base');
      await kbService.deleteVectors(existing.id);
      await strapi.documents('api::knowledge-base.knowledge-base').delete({
        documentId: existing.documentId,
      });
    }
    return;
  }

  const content = config.serialize(published);
  const title = published.title || published.name || `${config.name}文档`;

  if (existing) {
    await strapi.documents('api::knowledge-base.knowledge-base').update({
      documentId: existing.documentId,
      data: { title, content, locale, status: 'pending' },
    });
  } else {
    await strapi.documents('api::knowledge-base.knowledge-base').create({
      data: {
        title,
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

/** 生命周期 create/update 入口：薄封装 reconcileContent（忽略事件载荷内容，只取 documentId+locale） */
export async function syncSingleContent(strapi: any, uid: string, record: any): Promise<void> {
  return reconcileContent(strapi, uid, { documentId: record?.documentId, locale: record?.locale });
}

/** 生命周期 delete 入口：薄封装 reconcileContent（无 published 版本即删除） */
export async function deleteSyncedContent(strapi: any, uid: string, record: any): Promise<void> {
  return reconcileContent(strapi, uid, { documentId: record?.documentId, locale: record?.locale });
}
