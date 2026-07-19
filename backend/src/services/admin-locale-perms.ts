/**
 * Editor/Author 角色本地化权限自愈（幂等）。
 *
 * 背景（2026-07-19 线上事故）：老版本 Strapi 创建的 admin 权限 properties
 * 缺 locales 属性。@strapi/i18n 权限引擎对该情形的处理是注入
 * `locale: { $in: [] }` 空条件（dist/server/services/permissions/engine.js：
 * 仅 `locales === null` 才豁免条件），导致 Editor 文档级读写全部 403——
 * 而模型级 can.read 仍为 true，极具迷惑性。
 *
 * 修复语义在 Strapi 5.50+ 自带 normalizeRolePermissionsLocales 之上加强一档：
 *   缺失 / 空数组        → 补全量已启用 locale
 *   数组缺已启用 locale  → 并集补全（只增不减；2026-07-20 实测：zh-CN 为唯一
 *                          locale 时种下的行，后加 en-US 不跟上，Editor 切不到英文）
 *   已含全部已启用 locale → 不动
 *   null（全语言）        → 不动
 * 只增不减 = 不删人工可能配置的历史 locale，语义可预期、日志可观测。
 */

export async function ensureAdminLocalePermissions(strapi: any): Promise<{ patched: number }> {
  const i18n = strapi.plugin('i18n');
  const localeCodes: string[] = (await i18n.service('locales').find()).map((l: any) => l.code);
  if (localeCodes.length === 0) {
    console.warn('[admin-locale-perms] 未启用任何 locale，跳过');
    return { patched: 0 };
  }
  const { isLocalizedContentType } = i18n.service('content-types');

  const roles = await strapi.db.query('admin::role').findMany({
    where: { code: { $in: ['strapi-editor', 'strapi-author'] } },
  });
  if (roles.length === 0) return { patched: 0 };

  const permissions = await strapi.db.query('admin::permission').findMany({
    where: { role: { $in: roles.map((r: any) => r.id) } },
  });

  let patched = 0;
  for (const p of permissions) {
    if (!p.subject) continue;
    const ct = strapi.contentTypes[p.subject];
    if (!ct || !isLocalizedContentType(ct)) continue;

    const properties = p.properties || {};
    const current = properties.locales;
    if (current === null) continue; // null = 全语言豁免，不动

    const missing = !('locales' in properties);
    const empty = Array.isArray(current) && current.length === 0;
    if (missing || empty) {
      await strapi.db.query('admin::permission').update({
        where: { id: p.id },
        data: { properties: { ...properties, locales: localeCodes } },
      });
      patched++;
      continue;
    }

    // 数组缺已启用 locale → 并集补全（保持原顺序，追加缺失项）
    if (Array.isArray(current)) {
      const absent = localeCodes.filter((code) => !current.includes(code));
      if (absent.length === 0) continue;
      await strapi.db.query('admin::permission').update({
        where: { id: p.id },
        data: { properties: { ...properties, locales: [...current, ...absent] } },
      });
      patched++;
    }
  }

  if (patched > 0) {
    console.log(`[admin-locale-perms] 修复 ${patched} 条 Editor/Author 权限的 locales 属性 -> [${localeCodes.join(', ')}]`);
  }
  return { patched };
}

/**
 * Editor 权限行自愈（幂等）。
 *
 * 背景（2026-07-19 冒烟实测）：老库 strapi-editor 对后加的内容类型缺整行权限
 * （5 个 draftAndPublish 类型无 publish 行、13 个类型无 delete 行）——Strapi 只在
 * 角色首次创建时种默认权限（createRolesIfNoneExist），之后新增内容类型不补。
 *
 * 能力矩阵对齐 Strapi 内置 Editor 默认：api:: 内容类型 CRUD +
 * 有 draftAndPublish 的类型加 publish。只处理 Editor（客户场景只用 Editor；
 * Author 有 is-creator 条件语义，不在本自愈范围）。
 *
 * 例外（决策 D3 功能边界）：ai-config / vector-config 属超管专属配置，
 * Editor 不补建；已有的越权行一律回收（幂等）。
 */
const EDITOR_DENIED_TYPES = new Set([
  'api::ai-config.ai-config',
  'api::vector-config.vector-config',
]);

export async function ensureEditorContentPermissions(
  strapi: any
): Promise<{ created: number; revoked: number }> {
  const editor = await strapi.db.query('admin::role').findMany({ where: { code: 'strapi-editor' } });
  if (editor.length === 0) return { created: 0, revoked: 0 };
  const roleId = editor[0].id;

  const localeCodes: string[] = (await strapi.plugin('i18n').service('locales').find()).map((l: any) => l.code);

  const CM = 'plugin::content-manager.explorer';
  const apiUids = Object.keys(strapi.contentTypes).filter(
    (u: string) => u.startsWith('api::') && !EDITOR_DENIED_TYPES.has(u)
  );
  const existing = await strapi.db.query('admin::permission').findMany({ where: { role: roleId } });
  const has = (action: string, subject: string) =>
    existing.some((p: any) => p.action === action && p.subject === subject);

  // 1. 回收超管专属类型的越权行
  let revoked = 0;
  for (const p of existing) {
    if (p.subject && EDITOR_DENIED_TYPES.has(p.subject)) {
      await strapi.db.query('admin::permission').delete({ where: { id: p.id } });
      revoked++;
    }
  }

  // 2. 补齐缺失行
  let created = 0;
  for (const uid of apiUids) {
    const actions = [`${CM}.create`, `${CM}.read`, `${CM}.update`, `${CM}.delete`];
    if (strapi.contentTypes[uid].options?.draftAndPublish) {
      actions.push(`${CM}.publish`);
    }
    for (const action of actions) {
      if (has(action, uid)) continue;
      await strapi.db.query('admin::permission').create({
        data: {
          action,
          subject: uid,
          // locales 必须显式给全量——缺失会被 i18n 引擎注入 locale:$in:[] 空条件
          properties: { locales: localeCodes },
          conditions: [],
          role: roleId,
        },
      });
      created++;
    }
  }

  if (created > 0 || revoked > 0) {
    console.log(`[admin-locale-perms] Editor 权限行自愈：补建 ${created} 条，回收超管专属类型 ${revoked} 条`);
  }
  return { created, revoked };
}
