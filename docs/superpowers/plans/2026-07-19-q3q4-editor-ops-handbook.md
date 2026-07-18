# Q3/Q4 客户 Editor 账号 + 运营手册 + 后台 UI 冒烟 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** ① 运营方一条命令在客户实例上创建/重置后台 Editor 账号（客户拿到就能登录管内容）；② 交付《客户运营手册》，覆盖双语编辑、草稿/发布、动态区块等全部高频操作；③ 交付并执行一轮后台 UI 全流程冒烟（建/改/发布/取消发布/删除 × 各内容类型 × 双语），形成可复用的验证清单。

**架构：** 账号走 Strapi admin 面板体系（非 users-permissions）——社区版固定 3 角色，Editor（`strapi-editor`）可管全部内容、不能改系统设置/用户，与客户诉求精确匹配；创建/重置走 `strapi.service('admin::user')` 官方服务（自动哈希、自动处理角色关联），不直接插库。手册与冒烟清单作为母站交付物沉淀在 `docs/operations/`。

**技术栈：** Strapi v5 admin API（`admin::user`/`admin::role`/`admin::auth` 服务）、tsx 脚本、vitest。

**规格来源：** `docs/superpowers/specs/2026-07-19-master-site-hardening-design.md` Q3/Q4 节（决策 D3=Editor 面板账号并专项设计联动，D4=手册+冒烟）。

---

## 关键事实（实施前必读，已核实 node_modules 源码）

- Strapi 两套账号体系互不相通：`admin_users`（后台面板，社区版固定 Super Admin/Editor/Author 3 角色）vs `up_users`（REST API，自定义 client-admin 角色 79 权限只约束 API）。**客户内容管理走 admin 体系 Editor 角色。**
- Editor 角色查询：`strapi.db.query('admin::role').findOne({ where: { code: 'strapi-editor' } })`（常量定义于 `@strapi/admin/dist/server/server/src/services/constants.js`：`EDITOR_CODE = 'strapi-editor'`）。
- 密码哈希：`strapi.service('admin::auth').hashPassword(password)`（bcrypt, 10 轮，见 `admin/server/src/services/auth.js`）。
- 官方创建路径：`strapi.service('admin::user').create(attributes)` 内部自动调 hashPassword 并处理角色关联（见 `admin/server/src/services/user.js`）；更新走 `updateById(id, attributes)`。
- Editor 角色能力（Strapi 社区版默认）：Content Manager 全内容 CRUD + 发布流 + 媒体库；**不能**进 Settings（用户/角色/API token/Webhook/i18n 配置）、不能装插件。这正好匹配"客户管内容、运营方管系统"的分工。
- users-permissions 的 client-admin 角色（79 API 权限）保留不动——它服务的是"客户自有系统调 API"场景，与 Editor 面板账号互补不冲突。
- 测试命令：`cd backend && npx vitest run`。

## 与 Strapi 后台的联动设计（决策 D3 专项）

| 维度 | 设计 | 理由 |
|---|---|---|
| 账号归属 | 每个客户实例上创建独立 Editor 账号（实例级天然隔离） | 母站模式一客一实例，无需企业版多角色 |
| 创建/重置 | 运营方 SSH 到客户实例跑 `create-editor-account.ts`（幂等：存在则重置密码+确保角色+激活） | 一条命令，无需进 UI 点选 |
| 客户自助 | 客户用 Editor 登录后可改自己密码（后台右上角 Profile） | 运营方不长期持有客户密码 |
| 功能边界 | Editor 管内容；ai-config/vector-config/用户/设置仅超管（运营方） | 客户改不崩系统 |
| 回收 | 客户终止合作 → 运营方删账号或 `isActive: false`（脚本同支持 `--deactivate`） | 不残留入口 |

## 文件结构

- 创建：`backend/scripts/create-editor-account.ts` — 创建/重置/停用 Editor 账号（依赖注入可测）
- 创建：`backend/scripts/__tests__/create-editor-account.test.ts`
- 创建：`docs/operations/customer-handbook.md` — 《客户运营手册》
- 创建：`docs/operations/admin-ui-smoke-checklist.md` — 后台 UI 冒烟清单（本轮执行后填结果）

---

### 任务 1：create-editor-account.ts 脚本

**文件：**
- 创建：`backend/scripts/create-editor-account.ts`
- 测试：`backend/scripts/__tests__/create-editor-account.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `backend/scripts/__tests__/create-editor-account.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { manageEditorAccount } from '../create-editor-account';

describe('create-editor-account（Editor 面板账号管理）', () => {
  const editorRole = { id: 3, code: 'strapi-editor', name: 'Editor' };

  function makeStrapi(opts: { existingUser?: any } = {}) {
    const create = vi.fn().mockResolvedValue({ id: 10, email: 'client@example.com' });
    const updateById = vi.fn().mockResolvedValue({ id: 10 });
    const findOneUser = vi.fn().mockResolvedValue(opts.existingUser ?? null);
    const findOneRole = vi.fn().mockResolvedValue(editorRole);
    const hashPassword = vi.fn().mockResolvedValue('hashed-pw');
    const strapi: any = {
      db: {
        query: vi.fn((uid: string) => {
          if (uid === 'admin::role') return { findOne: findOneRole };
          if (uid === 'admin::user') return { findOne: findOneUser };
          throw new Error(`unexpected query ${uid}`);
        }),
      },
      service: vi.fn((uid: string) => {
        if (uid === 'admin::user') return { create, updateById };
        if (uid === 'admin::auth') return { hashPassword };
        throw new Error(`unexpected service ${uid}`);
      }),
    };
    return { strapi, create, updateById, findOneUser, hashPassword };
  }

  it('账号不存在 → 创建（Editor 角色 + 哈希密码 + isActive）', async () => {
    const { strapi, create, hashPassword } = makeStrapi();

    const result = await manageEditorAccount(strapi, {
      email: 'client@example.com',
      password: 'Str0ng!Passw0rd',
      firstname: '朱莉',
    });

    expect(hashPassword).not.toHaveBeenCalled(); // 哈希由 admin::user.create 内部完成
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'client@example.com',
        password: 'Str0ng!Passw0rd',
        firstname: '朱莉',
        isActive: true,
        roles: [3],
      })
    );
    expect(result).toEqual({ action: 'created', email: 'client@example.com' });
  });

  it('账号已存在 → 重置密码 + 确保 Editor 角色 + 激活（幂等）', async () => {
    const { strapi, create, updateById } = makeStrapi({
      existingUser: { id: 10, email: 'client@example.com', isActive: false },
    });

    const result = await manageEditorAccount(strapi, {
      email: 'client@example.com',
      password: 'NewPassw0rd!234',
    });

    expect(create).not.toHaveBeenCalled();
    expect(updateById).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ password: 'NewPassw0rd!234', isActive: true, roles: [3] })
    );
    expect(result).toEqual({ action: 'updated', email: 'client@example.com' });
  });

  it('deactivate 模式 → 仅停用不删数据', async () => {
    const { strapi, updateById } = makeStrapi({
      existingUser: { id: 10, email: 'client@example.com', isActive: true },
    });

    const result = await manageEditorAccount(strapi, {
      email: 'client@example.com',
      deactivate: true,
    });

    expect(updateById).toHaveBeenCalledWith(10, expect.objectContaining({ isActive: false }));
    expect(result).toEqual({ action: 'deactivated', email: 'client@example.com' });
  });

  it('strapi-editor 角色不存在 → 抛错', async () => {
    const { strapi } = makeStrapi();
    strapi.db.query = vi.fn(() => ({ findOne: vi.fn().mockResolvedValue(null) }));

    await expect(
      manageEditorAccount(strapi, { email: 'a@b.com', password: 'x'.repeat(12) })
    ).rejects.toThrow('strapi-editor');
  });

  it('创建模式缺 password → 抛错提示', async () => {
    const { strapi } = makeStrapi();
    await expect(
      manageEditorAccount(strapi, { email: 'a@b.com' })
    ).rejects.toThrow('password');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run scripts/__tests__/create-editor-account.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现脚本**

创建 `backend/scripts/create-editor-account.ts`：

```typescript
/**
 * 客户后台 Editor 账号管理（创建/重置/停用，幂等）。
 *
 * 为什么走 admin 体系而非 users-permissions：
 *   Strapi 社区版后台面板只有 3 个固定角色，Editor（strapi-editor）可管全部内容、
 *   不能改系统设置/用户——正好匹配"客户管内容、运营方管系统"。
 *   users-permissions 的 client-admin 角色只约束 REST API，对后台面板无效。
 *
 * 用法（backend 容器内）：
 *   # 创建或重置（已存在则重置密码+激活）
 *   npx tsx scripts/create-editor-account.ts --email zl@example.com --password 'Str0ng!Passw0rd' --firstname 朱莉
 *   # 停用（客户终止合作）
 *   npx tsx scripts/create-editor-account.ts --email zl@example.com --deactivate
 */

export interface EditorAccountParams {
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  deactivate?: boolean;
}

export async function manageEditorAccount(
  strapi: any,
  params: EditorAccountParams
): Promise<{ action: 'created' | 'updated' | 'deactivated'; email: string }> {
  const role = await strapi.db.query('admin::role').findOne({ where: { code: 'strapi-editor' } });
  if (!role) throw new Error('strapi-editor role not found（Strapi 初始化不完整）');

  const userService = strapi.service('admin::user');
  const existing = await strapi.db.query('admin::user').findOne({ where: { email: params.email } });

  if (params.deactivate) {
    if (!existing) throw new Error(`账号不存在: ${params.email}`);
    await userService.updateById(existing.id, { isActive: false });
    return { action: 'deactivated', email: params.email };
  }

  if (!params.password) {
    throw new Error('创建/重置账号必须提供 password（建议 12 位以上含大小写数字符号）');
  }

  if (existing) {
    // 幂等重置：密码 + 确保 Editor 角色 + 激活。哈希由 admin::user 服务内部完成
    await userService.updateById(existing.id, {
      password: params.password,
      isActive: true,
      roles: [role.id],
    });
    return { action: 'updated', email: params.email };
  }

  await userService.create({
    email: params.email,
    password: params.password,
    firstname: params.firstname ?? '客户',
    lastname: params.lastname ?? '管理员',
    isActive: true,
    roles: [role.id],
  });
  return { action: 'created', email: params.email };
}

function parseArgs(argv: string[]): EditorAccountParams {
  const params: EditorAccountParams = { email: '' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--deactivate') params.deactivate = true;
    else if (arg === '--email') params.email = argv[++i];
    else if (arg === '--password') params.password = argv[++i];
    else if (arg === '--firstname') params.firstname = argv[++i];
    else if (arg === '--lastname') params.lastname = argv[++i];
  }
  if (!params.email) {
    console.error('用法: npx tsx scripts/create-editor-account.ts --email <邮箱> [--password <密码>] [--firstname <名>] [--lastname <姓>] [--deactivate]');
    process.exit(1);
  }
  return params;
}

async function main() {
  const params = parseArgs(process.argv);
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    const result = await manageEditorAccount(strapi, params);
    console.log(`[create-editor-account] ${result.action}: ${result.email}`);
    if (result.action !== 'deactivated') {
      console.log('[create-editor-account] 请告知客户登录后第一时间在 Profile 修改密码');
    }
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run scripts/__tests__/create-editor-account.test.ts`
预期：5/5 PASS。

- [ ] **步骤 5：Commit**

```bash
git add backend/scripts/create-editor-account.ts backend/scripts/__tests__/create-editor-account.test.ts
git commit -m "feat(scripts): 客户 Editor 面板账号管理（创建/重置/停用，幂等）"
```

---

### 任务 2：《客户运营手册》docs/operations/customer-handbook.md

**文件：**
- 创建：`docs/operations/customer-handbook.md`

- [ ] **步骤 1：编写手册**

创建 `docs/operations/customer-handbook.md`，按以下完整大纲撰写（每节都必须写实，面向零 Strapi 经验的客户运营人员，配路径级操作指引）：

```markdown
# 客户运营手册（佑森小课堂后台）

## 1. 登录与账号
- 后台地址：http://<你的域名或IP>/admin，用运营方发的邮箱+密码登录，首次登录立即在右上角头像 → Profile 修改密码
- 你的角色是 Editor：可以管理全部内容和媒体库；看不到"设置"菜单是正常的（系统配置由运营方维护）
- 忘记密码 → 联系运营方重置（一条命令的事，不用不好意思）

## 2. 双语内容怎么管（最重要，90% 的问题出在这）
- 每条内容都有中文版和英文版**两个独立条目**：编辑页右上角 locale 切换器（zh-CN / en-US）
- 改完中文版不会自动改英文版；后台配置了翻译辅助，但**必须人工核对后点发布**
- 检查清单：每次内容改动后问自己——英文版改了吗？发布了吗？

## 3. 草稿与发布
- "保存"= 存草稿，前台看不到；"发布"= 上线，前台可见
- 列表页"状态"列：灰色=草稿，绿色=已发布
- 取消发布 = 下线但保留内容（前台立即不可见，AI 客服知识库同步移除）
- 删除 = 彻底删除（不可恢复，慎用）

## 4. 各内容类型操作要点
### 4.1 课程（产品）
- 字段：名称/简介/教学目标（可重复组件，点"添加条目"）/教学方式/价格/规格
- 价格是前台和 AI 客服的回答依据，改动后务必双语同步
### 4.2 校区
- 地址/电话/营业时间/交通：AI 客服直接引用，务必准确
- 地图坐标：经纬度两个字段（可让运营方协助从高德取数），不填地图不显示
- 联系人/联系电话留空时前台显示"—"，不要填"暂无"等占位文字
### 4.3 教师
- 教龄填数字（前台显示"x年"）；成就每行一条
### 4.4 新闻
- 发布日期字段决定前台排序，不是保存时间
### 4.5 FAQ
- 没有草稿态：保存即上线，改之前先想清楚
### 4.6 页面（动态区块）
- 首页/关于页等是"区块拼装"：hero/富文本/卡片列表/校区导航等区块按需添加、拖拽排序
- 每个区块都有自己的字段，保存前逐区块检查

## 5. 媒体库
- 支持 jpg/png/webp/svg/pdf，单文件建议 <10MB
- 图片替换 = 上传新图后到内容里重新选择，不要在媒体库直接删旧图（引用会断）

## 6. AI 客服与知识库（只读认知，无需操作）
- AI 客服的回答 100% 来自你发布的内容：课程/校区/教师/新闻/FAQ
- 你发布 → 几分钟内 AI 就会；你取消发布/删除 → AI 不再说
- 所以：**内容准确性 = AI 回答准确性**，价格/校区信息改动务必及时双语发布
- AI 答不上来时会引导家长留电话，这些线索在"预约/反馈"里

## 7. 预约与反馈（客户线索）
- "预约试听"和"在线咨询"提交的电话都在这里，支持导出
- 提交数据不可删除（合规保留），处理完把状态改为"已处理"

## 8. 常见坑（血泪清单）
1. 改了中文版忘了英文版 → 英文访客看到旧内容
2. 保存了没点发布 → 前台看不到以为出 bug
3. 取消发布 ≠ 删除，想彻底去掉用删除
4. 校区坐标不填 → 前台地图空白
5. 媒体库直接删图 → 页面图片 404

## 9. 找运营方协助的情形
- 改系统设置、加账号、配 AI 模型 key、地图坐标批量导入、任何"设置"菜单里的事
```

- [ ] **步骤 2：用户审阅**

手册是客户-facing 交付物，请用户审阅口径（语气、详略、第 8 节坑清单是否还有补充），按反馈修订。

- [ ] **步骤 3：Commit**

```bash
git add docs/operations/customer-handbook.md
git commit -m "docs(operations): 客户运营手册（双语/发布流/动态区块/线索/常见坑）"
```

---

### 任务 3：后台 UI 冒烟清单 + 执行

**文件：**
- 创建：`docs/operations/admin-ui-smoke-checklist.md`

- [ ] **步骤 1：编写冒烟清单**

创建 `docs/operations/admin-ui-smoke-checklist.md`：

```markdown
# 后台 UI 全流程冒烟清单

> 目的：每个客户实例交付前，用 Editor 账号把高频操作全流程过一遍，确保"客户能管内容不出 bug"。
> 执行方式：人工按表操作（每格 30 秒级），结果记 ✅/❌+备注。全程在测试实例或用"冒烟"前缀数据，执行完删除。
> 每行 6 步：建（保存草稿）→ 发布 → 改 → 取消发布 → 再发布 → 删除；每步中英两个 locale 各做一遍。

## A. 内容 CRUD × 双语 × 发布流

| # | 内容类型 | zh-CN 建/发布/改 | en-US 建/发布/改 | 取消发布→前台消失 | 删除→前台消失 | 结果 |
|---|---|---|---|---|---|---|
| A1 | 课程 product | | | | | |
| A2 | 校区 campus | | | | | |
| A3 | 教师 teacher | | | | | |
| A4 | 新闻 news-article | | | | | |
| A5 | FAQ faq-item（无草稿态，保存即上线，跳过发布/取消发布列） | | | — | | |
| A6 | 页面 page（含动态区块增删/排序） | | | | | |
| A7 | 导航 navigation / 页脚 footer / 站点设置 site-settings | | | — | — | |

## B. KB 联动（每条发布/取消发布后验证 AI 知识来源）

| # | 操作 | 验证 | 结果 |
|---|---|---|---|
| B1 | A1 课程发布后 | 后台"知识库"列表出现该课程条目（中/英各一），状态最终变 ready | |
| B2 | A1 课程取消发布后 | 知识库对应条目消失 | |
| B3 | A1 课程删除后 | 知识库对应条目消失 | |
| B4 | 向 AI 客服问一个知识库没有的问题（如"你们在火星有校区吗"） | 回答"暂无该信息"并引导转人工/留资，不编造 | |

## C. 媒体库

| # | 操作 | 验证 | 结果 |
|---|---|---|---|
| C1 | 上传 jpg/png | 缩略图正常，可插入课程内容，前台显示 | |
| C2 | 内容里引用后删除图片 | 前台 404——确认这是预期坑（手册 §8.5），恢复图片 | |

## D. 权限边界（用 Editor 账号执行）

| # | 操作 | 验证 | 结果 |
|---|---|---|---|
| D1 | 左侧菜单 | 无"设置"入口 | |
| D2 | 直接访问 /admin/settings/users | 403/无权限提示 | |
| D3 | 预约/反馈列表 | 可查看、可改状态、无删除按钮 | |
| D4 | Profile 改自己密码 | 成功，重新登录生效 | |

## E. 线索数据

| # | 操作 | 验证 | 结果 |
|---|---|---|---|
| E1 | 前台提交预约试听 | 后台"预约"列表出现，姓名/电话完整 | |
| E2 | 导出 | 导出文件可打开、数据完整 | |
```

- [ ] **步骤 2：在本地或测试实例执行冒烟并回填结果**

用任务 1 的脚本创建 Editor 测试账号，按清单执行，结果直接回填到表格里。发现的 bug 不走"顺手修掉"——记录后按 systematic-debugging 流程单独立项（冒烟的目的是发现，不是修复）。执行环境/账号/日期记到清单顶部。

- [ ] **步骤 3：Commit**

```bash
git add docs/operations/admin-ui-smoke-checklist.md
git commit -m "docs(operations): 后台 UI 冒烟清单 + 本轮执行结果"
```

---

### 任务 4：全量回归 + 交付

- [ ] **步骤 1：全量测试**

运行：`cd backend && npx vitest run && npm run typecheck`
预期：全部 PASS。

- [ ] **步骤 2：交付报告**

向用户报告：① Editor 账号脚本用法与测试结果；② 手册与冒烟清单路径；③ 冒烟执行发现的 bug 列表（如有）及建议立项优先级。

---

## 自检记录

- **规格覆盖：** D3(Editor 面板账号+Strapi 联动专项设计)=任务1+联动设计表（账号管理=脚本幂等创建/重置/停用；功能管理=Editor 角色边界+超管分工）；D4(手册+冒烟)=任务2/3 ✅
- **类型一致性：** `manageEditorAccount(strapi, params)` 返回 `{ action, email }`，`action ∈ created|updated|deactivated` 在测试/实现一致 ✅
- **不越界：** users-permissions client-admin 角色（79 API 权限）不动；R19 的"seed 只跑一次"约束不受影响 ✅
