# Strapi 后台 SEO 数据填写操作指南

## 一、SEO 组件字段说明

每个内容类型（页面、课程、新闻文章、教师、校区）都包含一个 **SEO 配置** 组件，共 8 个字段：

| 字段 | 类型 | 字符上限 | 用途 |
|------|------|---------|------|
| `metaTitle` | 文本 | 60 | 浏览器标签标题 + 搜索结果标题 |
| `metaDescription` | 文本 | 160 | 搜索结果描述摘要 |
| `metaKeywords` | 文本 | 200 | 关键词（主要给国内搜索引擎参考） |
| `canonicalUrl` | 文本 | 500 | 规范链接（防止重复页面） |
| `ogTitle` | 文本 | 60 | 微信/微博/钉钉分享卡片标题 |
| `ogDescription` | 文本 | 160 | 社交分享卡片描述 |
| `ogImage` | 媒体 | — | 社交分享卡片配图（建议 1200×630px） |
| `ogType` | 枚举 | — | Open Graph 类型：`website` / `article` / `product` |

## 二、在 Strapi 后台填写 SEO 数据

### 步骤

1. 登录 Strapi 后台 → `http://localhost:1337/admin`
2. 在左侧菜单选择对应的内容类型（如「页面」「产品」等）
3. 点击要编辑的条目
4. 在编辑页面底部找到 **SEO 配置** 区域
5. 填写各字段
6. 点击右上角 **保存** → **发布**

### 字段填写示例

#### 首页（ogType: website）

```
metaTitle:       幼小衔接教育_2026秋季班火热招生中
metaDescription: 专注幼小衔接教育8年，科学课程体系+专业师资团队，帮助3-6岁儿童自信迈入小学大门。4大核心优势，小班教学，立即预约免费试听！
metaKeywords:    幼小衔接,学前班,拼音启蒙,数学思维,英语口语,入学准备,北京幼小衔接
ogTitle:         幼小衔接教育 - 让每个孩子自信迈入小学大门
ogDescription:   8年专业幼小衔接教育经验，4大核心优势，小班教学，预约免费试听
ogType:          website
```

#### 课程详情页（ogType: product）

```
metaTitle:       语言启蒙课程_拼音识字与口语表达
metaDescription: 语言启蒙课程专为幼小衔接阶段设计，系统学习拼音、识字和口语表达，培养孩子语言表达能力，为小学语文学习打下坚实基础。
metaKeywords:    语言启蒙,拼音课程,识字课程,口语表达,幼小衔接语言
ogType:          product
```

#### 新闻文章（ogType: article）

```
metaTitle:       2026年幼小衔接教育峰会圆满举办
metaDescription: 2026年幼小衔接教育峰会在北京圆满举办，汇聚行业专家探讨幼小衔接教育发展趋势与课程创新。
ogType:          article
```

### ogImage 上传方法

1. 在 SEO 组件的 `ogImage` 字段点击 **添加媒体**
2. 上传图片或从媒体库选择
3. 推荐尺寸：**1200×630 像素**，格式 JPG/PNG，大小不超过 300KB
4. 图片将用于微信/微博/钉钉等社交平台的分享卡片

## 三、前端自动回退逻辑

如果 SEO 字段未填写，前端 Seo 组件会自动回退：

| 标签 | 优先级 1 | 优先级 2 | 优先级 3 |
|------|---------|---------|---------|
| `<title>` | seo.metaTitle | 页面 title 属性 | 站点名「幼小衔接教育」 |
| `meta description` | seo.metaDescription | 页面 description 属性 | 不渲染 |
| `og:title` | seo.ogTitle | seo.metaTitle | 页面 title 属性 |
| `og:description` | seo.ogDescription | seo.metaDescription | 页面 description 属性 |
| `og:image` | seo.ogImage（相对路径自动拼接 API 地址） | 页面 image 属性 | 不渲染 |
| `og:type` | type 属性 | seo.ogType | `website` |

**结论：即使不填写任何 SEO 字段，前端也会用页面标题作为回退，不会出现空白标题。**

## 四、各页面 SEO 数据填写建议

### 必填页面（已完成数据填充）

| 页面 | 建议优先级 | 状态 |
|------|-----------|------|
| 首页 (/) | P0 | ✅ 已填充 |
| 课程详情页（4个课程） | P0 | ✅ 已填充 |
| 新闻文章（3篇） | P1 | ✅ 已填充 |
| 学校介绍 | P1 | ✅ 已填充 |
| 资质荣誉 | P1 | ✅ 已填充 |
| 办学理念 | P2 | ✅ 已填充 |
| 联系我们 | P2 | ✅ 已填充 |

### 需手动上传 ogImage 的页面

以下页面已填写文本 SEO 字段，但 `ogImage` 需要在 Strapi 后台手动上传图片：

1. **首页** — 建议使用品牌主视觉图或校园环境图
2. **各课程详情页** — 建议使用课程场景图
3. **各新闻文章** — 建议使用文章封面图（可复用 coverImage）

## 五、SEO 最佳实践

### metaTitle
- 控制在 **30-40 个中文字符**（60 字节），超出部分在搜索结果中被截断
- 格式：`核心关键词_品牌名` 或 `核心关键词 - 品牌名`
- 不要堆砌关键词，1-2 个核心词即可

### metaDescription
- 控制在 **70-80 个中文字符**（160 字节）
- 包含核心关键词，自然描述页面内容
- 加入行动号召（CTA），如「立即预约」「免费试听」
- 每个页面的 description 应唯一，不要复制粘贴

### ogImage
- 尺寸 **1200×630 像素**（社交平台标准比例 1.91:1）
- 图片中可包含品牌 logo 和核心卖点文字
- 大小控制在 300KB 以内，避免影响加载速度
- 微信分享卡片会裁剪为 500×260，重要内容居中

### canonicalUrl
- 仅在页面有多个 URL 入口时填写（如带 tracking 参数的链接）
- 一般页面无需填写，前端不渲染 canonical link

## 六、GEO 扩展（面向 AI 搜索引擎）

Generative Engine Optimization (GEO) 是面向 AI 搜索引擎（如 ChatGPT、Perplexity、文心一言）的优化策略。以下为后续规划：

### 1. llms.txt 文件
在网站根目录放置 `llms.txt`，为 AI 爬虫提供结构化的站点概览：

```
# 幼小衔接教育

> 专注3-6岁儿童幼小衔接教育8年，提供语言启蒙、数学思维、英语口语、综合素养四大课程体系。

## 课程体系
- [语言启蒙](https://example.com/courses/language): 拼音识字与口语表达
- [数学思维](https://example.com/courses/math): 逻辑推理与数感培养
- [英语口语](https://example.com/courses/english): 自然拼读与日常对话
- [综合素养](https://example.com/courses/comprehensive): 社交礼仪与学习习惯

## 关于我们
- [学校介绍](https://example.com/about-school)
- [办学理念](https://example.com/about-philosophy)
- [资质荣誉](https://example.com/about-honors)

## 联系方式
- 电话: 400-xxx-xxxx
- 地址: 北京市xx区xx路xx号
```

### 2. AI 摘要结构化数据
在 JSON-LD 中增加 AI 友好的摘要字段：

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "语言启蒙",
  "description": "系统学习拼音、识字和口语表达",
  "provider": {
    "@type": "EducationalOrganization",
    "name": "幼小衔接教育"
  },
  "teaches": "拼音、识字、口语表达",
  "educationalLevel": "幼小衔接阶段（3-6岁）"
}
```

### 3. FAQ 结构化数据
在 FAQ 页面增加 `FAQPage` JSON-LD，让 AI 搜索引擎直接引用：

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "幼小衔接班适合几岁的孩子？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "适合3-6岁、即将进入小学的儿童。"
      }
    }
  ]
}
```

### GEO 实施时机建议

| 任务 | 建议时机 | 原因 |
|------|---------|------|
| llms.txt | 网站上线前 | 低成本、高收益 |
| Course JSON-LD 扩展 | 已完成（CourseDetail 已有基础结构化数据） | 可进一步扩展 teaches、educationalLevel 字段 |
| FAQPage JSON-LD | FAQ 内容稳定后 | 需要确保 FAQ 内容完整 |
| Sitemap.xml | 网站上线前 | 搜索引擎抓取必备 |
| robots.txt | 网站上线前 | 控制 AI 爬虫访问 |
