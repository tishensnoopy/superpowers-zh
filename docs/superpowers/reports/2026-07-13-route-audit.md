# 路由审计报告

- **审计日期**: 2026-07-13
- **审计范围**: `frontend-next/app/**` 全部页面路由 + 入口可达性
- **审计目的**: 识别孤儿页面（无入口）、入口冗余、导航缺失，确保企业官网布局完整

## 一、路由清单（17 个页面 + 1 个路由处理器）

### 静态页面（12）

| # | 路径 | 文件 | 用途 |
|---|------|------|------|
| 1 | `/` | `app/page.tsx` | 首页（7 个 section 动态组装） |
| 2 | `/news` | `app/news/page.tsx` | 新闻列表（分类筛选 + 分页） |
| 3 | `/contact` | `app/contact/page.tsx` | 联系我们（信息卡片 + 校区电话 + 表单） |
| 4 | `/faq` | `app/faq/page.tsx` | 常见问题（分类筛选 + 反馈） |
| 5 | `/appointment` | `app/appointment/page.tsx` | 预约试听（独立页 + ContactForm） |
| 6 | `/appointment-success` | `app/appointment-success/page.tsx` | 预约成功回显 |
| 7 | `/teachers` | `app/teachers/page.tsx` | 师资团队列表 |
| 8 | `/campuses` | `app/campuses/page.tsx` | 校区环境列表 |
| 9 | `/courses` | `app/courses/page.tsx` | 课程体系列表 + 搜索 |
| 10 | `/privacy-policy` | `app/privacy-policy/page.tsx` | 隐私政策 |
| 11 | `/user-agreement` | `app/user-agreement/page.tsx` | 用户协议 |
| 12 | `/refund-policy` | `app/refund-policy/page.tsx` | 退费政策 |

### 动态页面（5）

| # | 路径模式 | 文件 | 用途 |
|---|---------|------|------|
| 13 | `/[slug]` | `app/[slug]/page.tsx` | 通用页面（含 /about、/join-us 等 Strapi page 内容） |
| 14 | `/news/[slug]` | `app/news/[slug]/page.tsx` | 新闻详情 |
| 15 | `/courses/[slug]` | `app/courses/[slug]/page.tsx` | 课程详情 |
| 16 | `/campuses/[slug]` | `app/campuses/[slug]/page.tsx` | 校区详情 |
| 17 | `/teachers/[slug]` | `app/teachers/[slug]/page.tsx` | 教师详情 |

### 路由处理器（1）

| # | 路径 | 文件 | 用途 |
|---|------|------|------|
| 18 | `/llms.txt` | `app/llms.txt/route.ts` | AI 搜索引擎 GEO 优化（动态生成） |

## 二、导航入口盘点

### 顶部导航（Navigation.tsx，数据源 Strapi navigation）

种子数据 7 个一级菜单，其中 3 个带二级下拉：

| 一级菜单 | URL | 二级菜单 |
|---------|-----|---------|
| 首页 | `/` | — |
| 课程体系 | `/courses` | 幼小衔接全能班 / 课后托管班 / 全日制托班 |
| 校区环境 | `/campuses` | 百步亭 / 三阳路 / 动物园 / 钟家村 / 四新 / 沌口 |
| 师资团队 | `/teachers` | — |
| 新闻资讯 | `/news` | 公司动态 / 行业资讯 / 活动通知 |
| 关于我们 | `/about` | — |
| 联系我们 | `/contact` | — |

**右上角 CTA 按钮**: "预约免费试听" → `/appointment`（桌面 + 移动）

### Footer 入口

| 分组 | 链接 |
|------|------|
| 课程体系 | 3 个课程详情链接 |
| 关于我们 | /about、/teachers、/campuses、/news |
| 帮助中心（种子 quickLinks） | 预约试听、退费政策、常见问题、关于我们 |
| 底部法律声明 | /privacy-policy、/user-agreement |

### 页面内跳转入口

| 来源页面 | 目标页面 | 触发点 |
|---------|---------|--------|
| 首页 Hero | `/appointment` | "立即预约试听" CTA |
| 课程详情 | `/contact` | CourseCTA "咨询此课程" |
| 校区详情 | `/appointment` | 校区卡片 CTA（如有） |
| 预约表单提交成功 | `/appointment-success` | router.push |
| 404 页 | `/`、`/courses` | 返回首页/课程按钮 |

## 三、审计发现与修复

### 已修复问题

#### 1. `/appointment` 孤儿路由（P0 级）

- **问题**: `/appointment` 页面存在但无导航入口，原 Hero/Navigation 按钮均指向 `/contact`
- **修复**: 
  - `Navigation.tsx` "预约免费试听" 按钮 `/contact` → `/appointment`
  - `Hero.tsx` "立即预约试听" 按钮 `/contact` → `/appointment`
  - `Hero.test.tsx` 断言更新
- **提交**: `155c68a`

#### 2. 导航缺少二级下拉菜单（P1 级）

- **问题**: 原导航为扁平结构，课程/校区/新闻分类无下拉入口
- **修复**:
  - `seed-yousen.js` NAVIGATION 改为层级结构（父 + children）
  - `seedNavigation()` 两遍扫描：先创建父节点拿 documentId，再用 `parent` 关系创建子节点
  - `Navigation.tsx` 已支持 `children` 渲染（hover 展开 + click 切换）
- **提交**: `155c68a`

#### 3. 新闻资讯缺失导航入口（P1 级）

- **问题**: 原导航 7 项中无"新闻资讯"，用户只能从 Footer 进入
- **修复**: 在 NAVIGATION 数组中新增"新闻资讯"一级菜单（position: 5），含 3 个分类子链接
- **提交**: `155c68a`

### 待修复问题

#### 4. Footer 种子 "预约试听" 链接指向 /contact（P2 级）

- **问题**: `seed-yousen.js` FOOTER.quickLinks 中 `{ title: '预约试听', url: '/contact' }` 应改为 `/appointment`
- **影响**: Footer "帮助中心" 分组的"预约试听"链接跳到联系页而非独立预约页
- **建议**: 将 quickLinks 中"预约试听" url 改为 `/appointment`，"联系客服"作为独立项指向 `/contact`
- **状态**: 待修复

### 无问题确认

| 路由 | 入口 | 状态 |
|------|------|------|
| `/appointment-success` | 预约表单提交后 router.push | ✓ 正常（流程页面，无需直接入口） |
| `/privacy-policy` | Footer 底部 | ✓ 正常 |
| `/user-agreement` | Footer 底部 | ✓ 正常 |
| `/refund-policy` | Footer 帮助中心 | ✓ 正常 |
| `/[slug]` (/about 等) | 导航"关于我们" + Footer | ✓ 正常 |
| `/llms.txt` | 爬虫直接访问 | ✓ 正常（无需 UI 入口） |

## 四、企业官网布局完整性评估

### 必备页面检查清单

| 页面类型 | 是否存在 | 入口可见性 |
|---------|---------|-----------|
| 首页 | ✓ | 导航第 1 项 |
| 产品/服务列表 | ✓ 课程体系 | 导航第 2 项 |
| 产品/服务详情 | ✓ 课程详情 | 列表页 + 导航下拉 |
| 关于我们 | ✓ /about | 导航第 6 项 |
| 联系我们 | ✓ /contact | 导航第 7 项 |
| 新闻资讯 | ✓ | 导航第 5 项 |
| 团队介绍 | ✓ /teachers | 导航第 4 项 |
| 门店/校区展示 | ✓ /campuses | 导航第 3 项 |
| 预约/转化 | ✓ /appointment | 导航右上角 CTA + Hero CTA |
| FAQ | ✓ /faq | Footer 帮助中心 |
| 法律声明 | ✓ 隐私/用户/退费 | Footer 底部 |
| AI 搜索优化 | ✓ /llms.txt | 路由处理器 |

### 结论

- **17 个页面路由全部有可达入口**，无真正的孤儿页面
- **导航层级结构完整**：7 个一级菜单 + 3 个二级下拉，覆盖主要业务板块
- **转化路径清晰**：Hero CTA → /appointment → 表单提交 → /appointment-success
- **1 个 P2 待修复**：Footer 种子"预约试听"链接指向 /contact（建议改为 /appointment）

## 五、后续建议

1. **修复 P2-4**: 更新 seed-yousen.js FOOTER.quickLinks
2. **E2E 测试**: 编写 `e2e/route-audit.spec.ts` 自动化验证所有路由可达性
3. **移动端验证**: 确认移动端汉堡菜单展开后二级菜单可正常切换（已实现 click toggle）
4. **About 页面内容补充**: /about 目前通过 Strapi page 动态渲染，需确认 Strapi 内有完整板块内容（Stage 5 处理）
