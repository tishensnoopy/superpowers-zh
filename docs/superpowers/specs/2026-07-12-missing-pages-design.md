# 遗漏页面补全设计

**日期**：2026-07-12
**状态**：已批准
**范围**：404 页面 + 3 个合规页面（退费政策、隐私政策、用户协议）+ 举报中心形态决策

## 背景

首页 footer 已有"退费政策""隐私政策""用户协议""举报中心"四个链接占位（均指向 `#`），但无对应页面。前端 App.tsx 缺少 `*` 兜底路由，未匹配路径会导致白屏。

## 决策

### 1. 404 页面（现在做）

**组件**：`frontend/src/pages/NotFoundPage.tsx`

- 纯前端组件，不调 Strapi API，保证离线可显示
- 套用 `<Layout>` 保持导航栏 + 页脚一致
- 内容：大号 "404" 数字 + "页面未找到" 文案 + 返回首页按钮 + 返回上一页按钮
- 套 `<Seo title="页面未找到" />`
- 主色调 `linear-gradient(135deg, #F5851F, #FF6B35)` 与全站一致

**路由**：App.tsx 末尾加 `<Route path="*" element={<Layout><NotFoundPage /></Layout>} />`

- 必须放在 `/:slug` 之后（React Router v6 按特异性匹配，`*` 优先级最低，兜底所有未匹配路径）

**TDD 测试**：

1. 渲染 "404" 和 "页面未找到" 文案
2. 包含返回首页链接（指向 `/`）
3. 包含返回上一页按钮
4. Seo 标签注入正确 title

### 2. 合规页面（现在做，3 个 Strapi Page）

在 Strapi 创建 3 个 Page，各含 1 个 RichText section：

| slug | title | 内容 |
|------|-------|------|
| `refund-policy` | 退费政策 | 退费规则模板（适用场景、退费标准、流程、到账时间） |
| `privacy-policy` | 隐私政策 | 隐私条款模板（信息收集、使用、共享、保护、儿童隐私、Cookie） |
| `user-agreement` | 用户协议 | 用户协议模板（服务说明、用户行为、知识产权、免责声明、争议解决） |

- 每个 Page 填 SEO 字段（metaTitle、metaDescription）
- 模板基于教育行业通用做法，用户在 Strapi 后台审阅修改
- 前端无需改动——`PageRendererWithSlug` 已处理 `/:slug` 路由

### 3. Footer 链接更新

修改 `frontend/src/layout/Layout.tsx`：

- `退费政策` 的 `href="#"` → `href="/refund-policy"`
- `隐私政策` 的 `href="#"` → `href="/privacy-policy"`
- `用户协议` 的 `href="#"` → `href="/user-agreement"`
- `举报中心` 保持 `href="#"` 不动

### 4. 举报中心（延后）

本次不实现，footer 链接保持 `#`。未来 AI 客服对话功能上线后，举报入口放在对话界面内，不单独做页面。

## 验证

- 404 页面：前端单元测试 + 浏览器访问 `/random-nonexistent` 验证
- 合规页面：浏览器访问 `/refund-policy`、`/privacy-policy`、`/user-agreement` 验证内容渲染
- Footer：浏览器点击三个链接验证跳转
- 全量回归：`npm test` 确保无回归
