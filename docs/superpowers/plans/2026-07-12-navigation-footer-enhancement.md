# 导航栏二级菜单与页脚社交媒体链接实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现导航栏二级菜单（课程体系、校区介绍）和页脚社交媒体链接（微信、微博、抖音、QQ），包含悬停放大效果。

**架构：** 导航栏使用已有的 Strapi navigation collection 的 children 关系来存储二级菜单；页脚使用已有的 socialLinks 组件，前端添加悬停放大效果。

**技术栈：** React 18 + TypeScript + Vite + lucide-react + Tailwind CSS

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `backend/src/api/navigation/content-types/navigation/schema.json` | 导航数据模型（已有 children 关系） |
| `frontend/src/layout/Layout.tsx` | 布局组件（导航栏 + 页脚） |
| `frontend/src/lib/api.ts` | API 调用封装 |
| `frontend/src/layout/__tests__/Layout.test.tsx` | Layout 组件测试 |

---

### 任务 1：更新导航数据（添加二级菜单）

**文件：**
- 修改：`backend/src/api/navigation/content-types/navigation/schema.json`（已有 children 关系，无需修改）
- 数据：通过 Strapi 管理后台添加导航项及其子项

**步骤：**

- [ ] **步骤 1：验证后端 API 返回格式**

```bash
curl http://localhost:1337/api/navigation?populate=children
```

预期：返回导航项列表，包含 children 字段

- [ ] **步骤 2：确认当前导航数据**

```bash
curl http://localhost:1337/api/navigation
```

- [ ] **步骤 3：添加二级菜单数据（通过 Strapi 管理后台或 API）**

需要添加的导航结构：
```
首页 (/)
关于我们 (/about)
  ├── 学校介绍 (/about/school)
  ├── 办学理念 (/about/philosophy)
  └── 资质荣誉 (/about/awards)
课程体系 (/courses)
  ├── 语言启蒙 (/courses/language)
  ├── 数学思维 (/courses/math)
  ├── 英语口语 (/courses/english)
  └── 综合素养 (/courses/comprehensive)
校区介绍 (/campuses)
  ├── 朝阳校区 (/campuses/chaoyang)
  ├── 海淀校区 (/campuses/haidian)
  ├── 西城校区 (/campuses/xicheng)
  └── 丰台校区 (/campuses/fengtai)
师资团队 (/team)
联系我们 (/contact)
```

- [ ] **步骤 4：验证导航 API 返回包含子项**

```bash
curl http://localhost:1337/api/navigation?populate=children
```

预期：导航项包含 children.data 数组

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/navigation/content-types/navigation/schema.json
git commit -m "docs: update navigation structure with dropdown menus"
```

---

### 任务 2：更新 Layout.tsx 页脚添加社交媒体链接

**文件：**
- 修改：`frontend/src/layout/Layout.tsx`

**步骤：**

- [ ] **步骤 1：编写失败的测试**

```typescript
// frontend/src/layout/__tests__/Layout.test.tsx

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';

describe('Footer Social Links', () => {
  const mockFooter = {
    data: {
      attributes: {
        copyright: '© 2026 Test',
        socialLinks: {
          data: [
            { attributes: { platform: 'wechat', url: '#', label: '微信' } },
            { attributes: { platform: 'weibo', url: '#', label: '微博' } },
            { attributes: { platform: 'douyin', url: '#', label: '抖音' } },
            { attributes: { platform: 'qq', url: '#', label: 'QQ' } },
          ],
        },
        quickLinks: { data: [] },
      },
    },
  };

  beforeEach(() => {
    jest.spyOn(require('../lib/api'), 'getFooter').mockResolvedValue(mockFooter);
    jest.spyOn(require('../lib/api'), 'getSiteSettings').mockResolvedValue({
      data: [{ attributes: { name: 'Test', phone: '400-123-4567' } }],
    });
    jest.spyOn(require('../lib/api'), 'getNavigation').mockResolvedValue({
      data: [],
    });
  });

  test('renders social media links', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('关注我们');
    expect(screen.getByText('微信')).toBeInTheDocument();
    expect(screen.getByText('微博')).toBeInTheDocument();
    expect(screen.getByText('抖音')).toBeInTheDocument();
    expect(screen.getByText('QQ')).toBeInTheDocument();
  });

  test('social links have correct platform colors', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('微信');
    const wechatLink = screen.getByText('微信').closest('a');
    expect(wechatLink).toHaveClass('bg-[#07C160]');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npm test -- --run src/layout/__tests__/Layout.test.tsx
```

预期：FAIL，报错"关注我们"或社交链接未找到

- [ ] **步骤 3：编写最少实现代码**

在 `Layout.tsx` 页脚区域添加社交媒体链接：

```tsx
// 在页脚的快速链接之后添加社交媒体链接部分
{(footerAttrs.socialLinks?.data || []).length > 0 && (
  <div className="col-span-6 sm:col-span-4 lg:col-span-2">
    <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
      关注我们
    </h4>
    <div className="flex flex-wrap gap-3">
      {(footerAttrs.socialLinks.data || []).map((social: any) => {
        const socialAttrs = social.attributes || social;
        const platformColors: Record<string, string> = {
          wechat: 'bg-[#07C160]',
          weibo: 'bg-[#E6162D]',
          douyin: 'bg-[#FE2C55]',
          qq: 'bg-[#12B7F5]',
          linkedin: 'bg-[#0077B5]',
          twitter: 'bg-[#1DA1F2]',
          facebook: 'bg-[#1877F2]',
          instagram: 'bg-gradient-to-br from-[#405DE6] via-[#5851DB] to-[#833AB4]',
          youtube: 'bg-[#FF0000]',
        };
        const colorClass = platformColors[socialAttrs.platform] || 'bg-gray-500';
        
        return (
          <a
            key={social.id}
            href={socialAttrs.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm transition-all duration-300 hover:scale-110 hover:shadow-lg ${colorClass}`}
            title={socialAttrs.label}
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {socialAttrs.platform === 'wechat' && 'W'}
              {socialAttrs.platform === 'weibo' && '微'}
              {socialAttrs.platform === 'douyin' && 'D'}
              {socialAttrs.platform === 'qq' && 'Q'}
              {socialAttrs.platform === 'linkedin' && 'L'}
              {socialAttrs.platform === 'twitter' && 'T'}
              {socialAttrs.platform === 'facebook' && 'F'}
              {socialAttrs.platform === 'instagram' && 'I'}
              {socialAttrs.platform === 'youtube' && 'Y'}
            </span>
            <span>{socialAttrs.label}</span>
          </a>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npm test -- --run src/layout/__tests__/Layout.test.tsx
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/layout/Layout.tsx frontend/src/layout/__tests__/Layout.test.tsx
git commit -m "feat: add social media links to footer with hover effect"
```

---

### 任务 3：验证前端导航栏二级菜单已正确渲染

**文件：**
- 修改：`frontend/src/layout/Layout.tsx`（已有二级菜单渲染逻辑，需验证）

**步骤：**

- [ ] **步骤 1：编写测试验证二级菜单渲染**

```typescript
// frontend/src/layout/__tests__/Layout.test.tsx

describe('Navigation Dropdown', () => {
  const mockNavWithChildren = {
    data: [
      {
        id: 1,
        attributes: {
          name: '课程体系',
          url: '/courses',
          children: {
            data: [
              { id: 11, attributes: { name: '语言启蒙', url: '/courses/language' } },
              { id: 12, attributes: { name: '数学思维', url: '/courses/math' } },
            ],
          },
        },
      },
      {
        id: 2,
        attributes: {
          name: '首页',
          url: '/',
          children: { data: [] },
        },
      },
    ],
  };

  beforeEach(() => {
    jest.spyOn(require('../lib/api'), 'getNavigation').mockResolvedValue(mockNavWithChildren);
    jest.spyOn(require('../lib/api'), 'getSiteSettings').mockResolvedValue({
      data: [{ attributes: { name: 'Test' } }],
    });
    jest.spyOn(require('../lib/api'), 'getFooter').mockResolvedValue({
      data: [{ attributes: { socialLinks: { data: [] }, quickLinks: { data: [] } } }],
    });
  });

  test('renders dropdown menu for items with children', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('课程体系');
    expect(screen.getByText('语言启蒙')).toBeInTheDocument();
    expect(screen.getByText('数学思维')).toBeInTheDocument();
  });

  test('dropdown items have correct links', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('语言启蒙');
    const link = screen.getByText('语言启蒙').closest('a');
    expect(link).toHaveAttribute('href', '/courses/language');
  });
});
```

- [ ] **步骤 2：运行测试验证**

```bash
cd frontend && npm test -- --run src/layout/__tests__/Layout.test.tsx
```

预期：PASS（如果已有二级菜单逻辑）或 FAIL（如果需要修改）

- [ ] **步骤 3：修复导航栏渲染（如需要）**

检查 `Layout.tsx` 中的导航渲染逻辑，确保 children 数据结构正确处理。

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npm test -- --run src/layout/__tests__/Layout.test.tsx
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/layout/Layout.tsx frontend/src/layout/__tests__/Layout.test.tsx
git commit -m "fix: ensure navigation dropdown renders correctly"
```

---

### 任务 4：浏览器视觉验证

**文件：**
- 无（浏览器验证）

**步骤：**

- [ ] **步骤 1：启动开发服务器**

```bash
cd frontend && npm run dev
```

- [ ] **步骤 2：访问首页验证**

打开 http://localhost:5173/

验证项：
1. 导航栏显示：首页、关于我们▼、课程体系▼、校区介绍▼、师资团队、联系我们
2. 鼠标悬停在"关于我们"、"课程体系"、"校区介绍"时显示二级菜单
3. 页脚显示"关注我们"区域，包含微信、微博、抖音、QQ 链接
4. 鼠标悬停在社交链接上时图标放大（scale-110）

- [ ] **步骤 3：响应式测试**

调整浏览器宽度测试：
- 桌面（1280px+）：完整显示所有导航项和二级菜单
- 平板（768px）：导航项换行，二级菜单正常显示
- 手机（375px）：使用汉堡菜单，二级菜单正常展开

- [ ] **步骤 4：控制台检查**

确认无 error 和 warning。

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "test: browser visual verification passed"
```

---

## 自检

### 规格覆盖度
- ✅ 导航栏二级菜单：任务 1、任务 3
- ✅ 页脚社交媒体链接：任务 2
- ✅ 悬停放大效果：任务 2（hover:scale-110）
- ✅ 测试覆盖：任务 2、任务 3
- ✅ 浏览器验证：任务 4

### 占位符扫描
- ✅ 无"待定"、"TODO"等占位符
- ✅ 所有步骤包含完整代码
- ✅ 所有命令精确且可执行

### 类型一致性
- ✅ 使用与现有代码一致的类型（socialLinks.data、children.data）
- ✅ 使用与现有代码一致的平台枚举值（wechat、weibo、douyin、qq）

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-07-12-navigation-footer-enhancement.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
