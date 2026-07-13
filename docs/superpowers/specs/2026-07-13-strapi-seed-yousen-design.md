# Strapi 佑森内容 Seed 脚本设计

## 背景

Docker 生产环境部署后，Strapi 后端内容数据缺失（首页只有 1 个 hero section，products 为 0）。需要编写 seed 脚本，基于佑森文件夹中的真实素材，自动填充首页 sections、课程、校区、教师、新闻、FAQ 等全部内容。

## 目标

- 基于 `佑森/` 文件夹真实数据填充 Strapi 全部 content-type
- 脚本幂等可重跑，不破坏手动修改
- 上传关键图片到 Strapi（LOGO、校区环境、教师照片、课程介绍、新闻封面）
- 在 Docker 容器内用 Bootstrap Strapi 方式执行

## 技术方案

### 执行方式：Bootstrap Strapi

脚本通过 `createStrapi().load()` 启动 Strapi 实例，用 `strapi.documents()` 服务层 API 写入数据，用 `strapi.upload` 服务上传图片。

```js
const { createStrapi } = require('@strapi/strapi');
const strapi = await createStrapi().load();
// strapi.documents('api::product.product').create({ data: { ... } });
// strapi.upload.upload({ files, data });
await strapi.destroy();
```

执行方式：`docker compose exec backend node scripts/seed-yousen.js`

### Schema 前置修改

新闻文章 `news-article` 目前没有 `tags` 字段。需要添加：

```json
{
  "name": "tags",
  "type": "string",
  "description": "逗号分隔的标签"
}
```

与 FAQ Item 的 `tags` 字段保持一致。seed 脚本启动时检查此字段是否存在，缺失则提示先运行 schema 更新。

### Docker Volume 映射

在 `docker-compose.yml` 的 `backend` 服务添加临时 volume 映射，让容器能读取佑森图片：

```yaml
volumes:
  - ./佑森:/data/yousen:ro
```

seed 完成后可移除（图片已上传到 Strapi 的 uploads 目录）。

## CLI 接口

```bash
# 全量填充
docker compose exec backend node scripts/seed-yousen.js

# 只填指定实体
docker compose exec backend node scripts/seed-yousen.js --only=settings,navigation,footer,courses,campuses,teachers,faqs,news,pages

# 强制更新已存在的记录（覆盖 seed 字段，保留手动添加的字段）
docker compose exec backend node scripts/seed-yousen.js --force

# 移除 seed 创建的记录
docker compose exec backend node scripts/seed-yousen.js --remove

# 只移除指定实体
docker compose exec backend node scripts/seed-yousen.js --remove --only=courses,campuses
```

## 幂等策略

- **查重**：用 `slug` 字段查找已有记录
- **默认**：已存在则跳过，打印 `⚠ 已存在，跳过 (slug=xxx)`
- **`--force`**：已存在则用 `createOrUpdate` 更新 seed 字段，不触碰非 seed 字段
- **`--remove`**：按 slug 删除 seed 创建的记录

所有 seed 创建的 slug 统一加 `yousen-` 前缀（如 `yousen-youxiao-xianjie`），便于区分 seed 数据和手动数据。

## 内容数据计划

### 1. Site Settings（单条）

| 字段 | 值 |
|------|-----|
| name | 武汉佑森小课堂艺术培训学校有限公司 |
| slogan | 专注幼小衔接教育8年 |
| phone | （待填） |
| email | （待填） |
| address | 武汉市 |
| icp | （待填） |

### 2. Navigation（~6 项）

| title | path | type |
|-------|------|------|
| 首页 | / | internal |
| 课程体系 | /courses | internal |
| 校区环境 | /campuses | internal |
| 师资团队 | /teachers | internal |
| 关于我们 | /about | internal |
| 联系我们 | /contact | internal |

### 3. Footer（单条）

- quickLinks: 预约流程、退费政策、常见问题、联系客服
- socialLinks: 微信、微博、抖音
- copyright: © 2026 佑森小课堂

### 4. Product Categories（3 个）

| name | slug |
|------|------|
| 幼小衔接 | yousen-youxiao-xianjie |
| 课后托管 | yousen-kehao-tuoguan |
| 托班 | yousen-tuoban |

### 5. Products / Courses（3 个）

#### 幼小衔接（yousen-youxiao-xianjie）

| 字段 | 值 |
|------|-----|
| name | 幼小衔接全能班 |
| shortDescription | 5 大模块系统课程，帮助孩子顺利过渡到小学 |
| description | 覆盖语文素养、数学思维、英语启蒙、学习习惯、社交适应 5 大核心模块，16-20 人小班教学，师资分科教学 |
| price | （待填） |
| specValues | {"课时": "160课时", "班额": "16-20人", "适合年龄": "5-6岁", "课程周期": "1学年"} |
| teachingMethod | 小班教学 + 分科授课 + 室内课堂 + 户外研学 |
| objectives | 1. 拼音识字基础 2. 数学逻辑思维 3. 英语听说入门 4. 良好学习习惯 5. 社交适应能力 |
| categories | 幼小衔接 |
| thumbnail | `佑森/课程介绍/6学前衔接.JPG` |

#### 课后托管（yousen-kehao-tuoguan）

| 字段 | 值 |
|------|-----|
| name | 课后托管班 |
| shortDescription | 放学后作业辅导 + 兴趣拓展 |
| description | 为已入学小学生提供课后作业辅导、查漏补缺、兴趣培养服务 |
| specValues | {"服务时间": "放学-18:30", "班额": "10-15人", "适合年级": "1-3年级"} |
| categories | 课后托管 |
| thumbnail | `佑森/课程介绍/11衔接托管班.JPG` |

#### 托班（yousen-tuoban）

| 字段 | 值 |
|------|-----|
| name | 全日制托班 |
| shortDescription | 3-5 岁幼儿全日制托管 |
| description | 提供安全、温暖的日间托管环境，含两餐一点、午休、游戏活动、启蒙教育 |
| specValues | {"服务时间": "8:00-17:00", "班额": "12-15人", "适合年龄": "3-5岁"} |
| categories | 托班 |
| thumbnail | `佑森/课程介绍/5习惯养成.jpg` |

### 6. Campuses（6 个）

校区名以佑森文件夹的 `六大校区环境/` 子目录名为准（图片路径直接对应）：

| 显示名 | 图片文件夹 | slug | area | 评分 | 评论数 | 预约人数 | 定位 |
|--------|----------|------|------|------|--------|---------|------|
| 百步亭校区 | 百步亭 | yousen-baibuting | 江岸区 | 4.9 | 168 | 1200+ | 旗舰校区 |
| 三阳路校区 | 三阳路 | yousen-sanyanglu | 江岸区 | 4.8 | 132 | 980+ | 师资强 |
| 动物园校区 | 动物园 | yousen-dongwuyuan | 汉阳区 | 4.8 | 98 | 760+ | 交通便利 |
| 钟家村校区 | 钟家村 | yousen-zhongjiacun | 汉阳区 | 4.9 | 145 | 1100+ | 口碑老校 |
| 四新校区 | 四新 | yousen-sixin | 汉阳区 | 4.7 | 86 | 620+ | 新兴校区 |
| 沌口校区 | 沌口 | yousen-zhuankou | 经开区 | 4.7 | 72 | 580+ | 环境优美 |

教师照片文件夹映射（教师照片文件夹名与校区文件夹名不完全一致）：

| 教师照片文件夹 | 对应校区 |
|--------------|---------|
| 三阳路校区 | 三阳路 |
| 四新校区 | 四新 |
| 钟家村校区 | 钟家村 |
| 沌口校区 | 沌口 |
| 动物园校区 | 动物园 |
| 金桥校区 | 百步亭（金桥无独立校区环境文件夹，归入百步亭） |

每个校区含：coverImage + gallery（2-3 张环境照片）

### 7. Teachers（6 位）

| name | title | campus | subject | teachingYears | education |
|------|-------|--------|---------|--------------|-----------|
| 王老师 | 高级教师 | 百步亭 | pinyin | 8 | 本科 |
| 李老师 | 特级教师 | 三阳路 | math | 10 | 本科 |
| 张老师 | 高级教师 | 动物园 | english | 6 | 本科 |
| 陈老师 | 资深教师 | 钟家村 | comprehensive | 9 | 本科 |
| 刘老师 | 优秀教师 | 四新 | pinyin | 5 | 本科 |
| 赵老师 | 资深教师 | 沌口 | math | 7 | 本科 |

teachingFeatures: "小班教学经验丰富，善于激发孩子学习兴趣"

### 8. FAQ Items（8 条）

| question | category | tags |
|----------|----------|------|
| 幼小衔接有必要上吗？ | course | 幼小衔接,入学准备 |
| 佑森的幼小衔接课程包括什么？ | course | 课程内容,幼小衔接 |
| 课后托管和晚托有什么区别？ | service | 课后托管,晚托 |
| 佑森的班额是多少？ | course | 班额,小班教学 |
| 孩子没有基础可以上吗？ | course | 零基础,入学 |
| 校区地址在哪里？ | service | 校区,地址 |
| 怎么预约试听？ | service | 预约,试听 |
| 退费政策是什么？ | policy | 退费,退款 |

### 9. News Articles（10 篇）

| # | title | category | tags | isFeatured |
|---|-------|----------|------|-----------|
| 1 | 佑森小课堂：8 年专注幼小衔接教育 | company_news | 品牌故事,幼小衔接 | true |
| 2 | 2026 年秋季班招生开启 | event_notice | 招生,秋季班 | true |
| 3 | 科学幼小衔接：不只是知识，更是习惯 | industry_news | 教学理念,学习习惯 | true |
| 4 | 佑森 6 大校区全面升级 | company_news | 校区,升级 | false |
| 5 | 户外研学：让孩子在实践中成长 | industry_news | 研学,户外活动 | false |
| 6 | 师资团队：14 位认证教师保驾护航 | company_news | 师资,教师团队 | true |
| 7 | 口碑认证：连续 5 年优质教育机构 | company_news | 口碑,荣誉 | false |
| 8 | 幼小衔接家长常见误区 | industry_news | 家长指南,误区 | false |
| 9 | 2026 暑期班圆满结业 | event_notice | 暑期班,结业 | false |
| 10 | AI 时代下的幼儿教育探索 | industry_news | AI教育,创新 | false |

每篇含：title、slug、excerpt（2-3 句）、content（300-500 字正文）、coverImage、category、tags、isFeatured

### 10. Pages + Sections

#### 首页（slug=homepage）

按顺序添加 7 个 sections：

1. **section.hero** — 主标题"让每个孩子自信迈入小学大门"，副标题"专注幼小衔接教育8年"，CTA"预约免费试听"
2. **section.advantages** — 4 个优势：8年+专注、3000+毕业学员、98%家长满意度、6所直营校区
3. **section.product-grid** — 标题"课程体系"，展示 3 个课程
4. **section.features** — 标题"教学特色"，4 个特色：小班教学、分科授课、室内+户外、研学活动
5. **section.testimonials** — 标题"家长口碑"，3 条家长评价
6. **section.contact-form** — 标题"预约免费试听"
7. **section.faq** — 标题"常见问题"，关联 8 条 FAQ

#### 关于我们页（slug=about）

- section.rich-text — 学校介绍、办学理念、发展历程

#### 退费政策页（slug=refund-policy）

- section.rich-text — 退费政策详细说明

## 图片上传计划

| 图片用途 | 来源路径（容器内） | 数量 |
|---------|-------------------|------|
| LOGO | `/data/yousen/LOGO/3FB0E536B592AE2334D3F049ECB0CFEB(1).png` | 1 |
| 校区封面 | `/data/yousen/六大校区环境/{百步亭\|三阳路\|动物园\|钟家村\|四新\|沌口}1.jpg` | 6 |
| 校区图集 | 同上目录的 2.jpg、3.jpg | 12 |
| 教师头像 | `/data/yousen/佑森小课堂老师照片/{对应教师照片文件夹}/第1张.jpg` | 6 |
| 课程介绍图 | `/data/yousen/课程介绍/{对应图片}.JPG` | 3 |
| 新闻封面 | `/data/yousen/海报图片/outputs/website-materials-v2/` 下各子目录的 PC 版图片 | 10 |

上传流程：
1. 读取文件到 Buffer
2. 调用 `strapi.upload.upload({ files: { name, path, type }, data: {} })`
3. 获取返回的 `file.id`
4. 在创建记录时通过 `thumbnail: file.id` 或 `coverImage: file.id` 关联

## 约束

- **"外冲"内容不公开**：不创建"外小游园备考"相关课程和文章（政策敏感期）
- **校区地址**：佑森文档未提供精确地址，用校区名 + 武汉市作为占位，后续手动补全
- **教师个人信息**：照片有但姓名/职称未知，用占位姓名（王老师/李老师等），后续手动补全
- **价格信息**：课程价格用 0 或留空，后续手动填写

## 文件清单

| 文件 | 用途 |
|------|------|
| `backend/scripts/seed-yousen.js` | 主 seed 脚本 |
| `docker-compose.yml` | 添加 `./佑森:/data/yousen:ro` volume 映射 |
| `backend/src/api/news-article/content-types/news-article/schema.json` | 添加 `tags` 字段 |

## 验证标准

1. 运行 `docker compose exec backend node scripts/seed-yousen.js` 无报错
2. 首页 http://localhost:3000 显示完整内容（hero + advantages + courses + features + testimonials + contact-form + faq）
3. /courses 页面显示 3 个课程
4. /campuses 页面显示 6 个校区
5. /teachers 页面显示 6 位教师
6. /news 页面显示 10 篇文章
7. /faq 页面显示 8 条 FAQ
8. 再次运行 seed 脚本，所有记录显示"已存在，跳过"
9. `--force` 运行后，记录更新成功
10. `--remove` 运行后，记录删除成功
