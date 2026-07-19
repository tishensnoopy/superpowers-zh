# 运营方部署与执行手册

> 📌 这本手册写给**你自己（运营方）**。客户管内容看另一本《客户运营手册》（customer-handbook.md）。
> 你不需要懂代码——本手册所有操作都是"复制命令 → 粘贴 → 回车"。遇到没见过的报错，把报错整段复制下来再求助。

---

## 1. 开始前：你只需要会 3 件事

1. **打开终端**
   - Windows：按 `Win + R`，输入 `cmd` 回车（或用 PowerShell / Windows Terminal）
   - Mac：按 `Cmd + 空格`，输入 `终端` 或 `Terminal` 回车
2. **粘贴命令**：把手册里的命令整行复制，在终端里右键（或 `Ctrl+V` / `Cmd+V`）粘贴，按回车执行
3. **看懂两种结果**：
   - 没有红色字、最后一行是提示符 → 成功了
   - 有红色字或 `error` / `failed` / `denied` → 失败了，把整段复制下来

> ⚠️ **纪律：命令必须整行原样复制，一个字母都不能改。** 改错了轻则报错了重则删错数据。

---

## 2. 服务器基础信息（贴在便签上）

| 项目 | 值 | 说明 |
|------|---|------|
| 服务器 IP | `124.223.1.67` | 客户网站就跑在这台机器上 |
| SSH 登录用户 | `ubuntu` | 登录后用 sudo 执行管理命令 |
| 网站代码目录 | `/opt/customer-site/` | 所有操作基本都在这个目录下进行 |
| 前台地址 | `http://124.223.1.67:3001` | 客户和家长访问的网站 |
| 后台地址 | `http://124.223.1.67:1337/admin` | Strapi 内容管理后台 |
| Central 管理台 | `/opt/central/` | 多租户中央管理（另一套，别混） |

### 2.1 怎么登录服务器

**Windows（PowerShell）：**

```powershell
ssh ubuntu@124.223.1.67
```

提示 `password:` 时输入服务器密码（输入时屏幕**不会显示任何字符**，这是正常的，输完回车即可）。

**登录成功的标志：** 提示符变成 `ubuntu@<主机名>:~$`。

### 2.2 关于 sudo（管理员权限）

服务器上 Docker 命令需要管理员权限。两种方式：

```bash
# 方式一：每条命令前加 sudo，首次会要求输密码
sudo docker ps

# 方式二：登录后先切到 root（推荐，后续命令都不用加 sudo）
echo '你的服务器密码' | sudo -S -i
```

> 下文所有命令**假设你已切到 root**（提示符是 `root@...:~#`）。如果没切 root，每条 `docker` 命令前自己加 `sudo `。

---

## 3. 日常巡检（建议每天一次，2 分钟）

### 3.1 看容器是否都活着

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**正常应该看到 6 个容器全是 `Up ... (healthy)`：**

| 容器名 | 作用 | 挂了会怎样 |
|--------|------|-----------|
| `yousen-postgres` | 数据库 | 全站瘫痪 |
| `yousen-redis` | 队列缓存 | AI 知识库不更新 |
| `yousen-meilisearch` | 搜索 | 前台搜索失效 |
| `yousen-backend` | Strapi 后端 | 后台打不开、API 全挂 |
| `yousen-frontend` | Next.js 前端 | 网站打不开 |
| `yousen-agent`（如有） | 连 Central | Central 看不到此机 |

如果某个容器显示 `Exited` 或 `Restarting`，去第 8 节"常见故障"。

### 3.2 快速验证网站活着

```bash
curl -s -o /dev/null -w "前端:%{http_code} " http://localhost:3001/
curl -s http://localhost:1337/_health && echo " 后端OK"
```

**正常输出：** `前端:200 后端OK`（或健康检查返回 204）。

### 3.3 看资源够不够用

```bash
free -h && df -h / && uptime
```

| 看什么 | 危险线 | 超了怎么办 |
|--------|--------|-----------|
| 内存 `available` | < 500MB | `docker system prune -f`，还不行重启 backend |
| 磁盘 `/` 可用 | < 10GB | `docker system prune -f` + 删旧备份 |
| 负载 `load average` | 第 3 个数 > 4 | `docker stats --no-stream` 找吃资源的容器 |

---

## 4. 改完代码怎么上线（部署流程）

> ⚠️ **铁律：本地测试全部通过才能往服务器发。** 没跑测试就部署 = 拿客户网站赌博。

### 4.1 第一步：本地验证（在你自己的电脑上）

```bash
cd 项目目录/backend
npx vitest run
```

看到 `Test Files  X passed` 全绿才算过。有红的先修，别部署。

### 4.2 第二步：提交代码

```bash
git add -A
git commit -m "说清楚改了什么"
```

### 4.3 第三步：同步代码到服务器

在**本地项目根目录**执行（注意排除清单，`.env`、上传文件、依赖目录**绝不能**同步）：

```bash
rsync -avz --delete \
  --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  --exclude='dist/' --exclude='build/' \
  --exclude='.env' --exclude='*.log' --exclude='data/' \
  --exclude='strapi_uploads/' --exclude='strapi_pg_data/' \
  --exclude='strapi_redis_data/' --exclude='strapi_meili_data/' \
  --exclude='.cache/' --exclude='.npmrc' \
  --exclude='central/' --exclude='agent/' \
  --exclude='backend/public/uploads/' \
  -e ssh \
  ./ ubuntu@124.223.1.67:/opt/customer-site/
```

> 💡 如果服务器 SSH 不是密钥登录， rsync 会提示输密码。也可以用 `sshpass -p '密码' rsync ...`（把 `sshpass -p '密码' ` 加在 rsync 前面）。

### 4.4 第四步：服务器上重建

SSH 登录服务器后：

```bash
cd /opt/customer-site
docker compose up -d --build backend frontend
```

等 2-3 分钟，然后健康检查：

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
curl -s -o /dev/null -w "前端:%{http_code}\n" http://localhost:3001/
curl -s -o /dev/null -w "后台:%{http_code}\n" http://localhost:1337/admin
```

两个都返回 200 才算部署成功。

### 4.5 第五步：上线后 5 点验证清单（必做）

每次部署后，打开浏览器逐项确认：

- [ ] **前台首页能打开**：`http://124.223.1.67:3001`，无白屏无报错
- [ ] **校区下拉菜单**：前台校区导航展开，中英文各 6 个子项都在
- [ ] **校区地图正常显示**：进任一校区详情页，高德地图能渲染、有标记点
- [ ] **"了解详情"链接可点**：点击跳到 `/about` 页面，不 404
- [ ] **后台登录正常**：`http://124.223.1.67:1337/admin` 能登录，内容列表能打开

> 任何一项不过 → 先去第 8 节"常见故障"，解决不了就回滚（4.6）。

### 4.6 出问题了怎么回滚

```bash
cd /opt/customer-site
git log --oneline -5          # 找到上一个正常的 commit 号（前 7 位）
git checkout <上一个commit号>
docker compose up -d --build backend frontend
```

---

## 5. 客户后台账号管理（最高频操作）

客户管内容用的是 **Editor 账号**。你通过一条命令创建/重置/停用，不用进后台点。

### 5.1 给新客户开通后台账号

SSH 登录服务器，执行：

```bash
cd /opt/customer-site
docker compose exec backend npx tsx scripts/create-editor-account.ts \
  --email 客户邮箱@example.com \
  --password '初始密码' \
  --firstname 客户名字
```

**示例：**

```bash
docker compose exec backend npx tsx scripts/create-editor-account.ts \
  --email zhangli@yousen.com \
  --password 'Yousen2026!JL' \
  --firstname 朱莉
```

看到 `[create-editor-account] created: zhangli@yousen.com` 即成功。

**然后把这三样发给客户：**
1. 后台地址：`http://124.223.1.67:1337/admin`
2. 邮箱和初始密码
3. 《客户运营手册》（customer-handbook.md），并提醒**首次登录立即改密码**

> 💡 密码要求：建议 12 位以上，含大小写字母 + 数字 + 符号。

### 5.2 客户忘记密码 → 重置

**同一条命令**，已存在的邮箱会自动变成"重置密码 + 激活"：

```bash
docker compose exec backend npx tsx scripts/create-editor-account.ts \
  --email zhangli@yousen.com \
  --password '新密码456!Ab'
```

看到 `[create-editor-account] updated: ...` 即成功。把新密码发给客户，提醒登录后改自己的密码。

### 5.3 客户终止合作 → 停用账号

```bash
docker compose exec backend npx tsx scripts/create-editor-account.ts \
  --email zhangli@yousen.com \
  --deactivate
```

看到 `deactivated` 即成功。**账号数据保留**（操作记录可追溯），但无法再登录。想彻底删除请联系技术负责人。

---

## 6. 客户常见请求处理

### 6.1 "帮我导入校区地图坐标"

客户在手册里被指引：不会取坐标就发地址列表给你。拿到地址后：

1. 打开[高德坐标拾取器](https://lbs.amap.com/tools/picker)，逐个搜索地址，记下经纬度
2. 登录后台（超管账号）→ 内容管理 → 校区 → 逐条填入 `latitude`（纬度）和 `longitude`（经度）字段 → Save → Publish
3. 检查前台校区详情页地图是否正常

> ⚠️ 高德系坐标是 **GCJ-02**，必须从高德取，不能用 Google/百度坐标（会偏移几百米）。

### 6.2 "新闻想置顶/调顺序"

新闻前台按**发布时间**自动排序，后台改不了顺序。处理方式：

- 轻量做法：在后台把那条新闻的发布时间改新（编辑 → 改日期字段 → 发布）
- 需要"置顶"功能 → 这是功能开发，记入需求清单，排期开发

### 6.3 "AI 客服回答不对/答的是旧内容"

AI 回答 100% 来自后台已发布内容。按顺序排查：

**第一步：确认内容本身**
- 让客户确认该内容**已发布**（不是草稿）且中英文都改了

**第二步：手动重建知识库**（内容确认无误但 AI 还答错时）

```bash
cd /opt/customer-site
docker compose exec backend npx tsx scripts/rebuild-kb-from-published.ts
```

这会把知识库清空、按当前已发布内容重新生成 + 向量化。跑完后 AI 即引用最新内容。

**第三步：看后端日志**（重建后仍不对）

```bash
docker compose logs --tail 100 backend | grep -i 'kb\|embed\|vector'
```

把输出复制下来找技术负责人。

### 6.4 "后台某个列表打不开，提示无权限"

**这通常是权限行缺失**——系统启动时有自愈机制，重启 backend 即可触发：

```bash
docker compose restart backend
sleep 90
docker compose logs --tail 30 backend | grep -i 'bootstrap-health\|admin-locale-perms'
```

看到 `OK` 或 `修复 X 条` 即自愈完成，让客户刷新后台重试。仍不行的把日志发给技术负责人。

### 6.5 "图片传上去前台不显示"

1. 后台媒体库确认图片已上传成功（能看到缩略图）
2. 确认引用该图的内容**已发布**
3. 前台强刷：`Ctrl + Shift + R`（Mac：`Cmd + Shift + R`）
4. 还不行 → 检查 uploads 目录挂载：`docker compose exec backend ls /opt/app/public/uploads | head`（有文件则正常，把情况发给技术负责人）

---

## 7. 备份与恢复

### 7.1 备份策略（已配置则跳过，未配置按此配置）

| 备份对象 | 频率 | 保留 |
|---------|------|------|
| 数据库 | 每天凌晨 3:30 | 7 天 |
| 上传文件 | 每周日凌晨 4:00 | 4 周 |
| `.env` | 每次改动后手动 | 永久 |

**配置自动备份（服务器上执行一次）：**

```bash
mkdir -p /opt/backups/customer-site

(crontab -l 2>/dev/null; echo '30 3 * * * docker exec yousen-postgres pg_dump -U strapi strapi | gzip > /opt/backups/customer-site/customer_$(date +\%Y\%m\%d).sql.gz && find /opt/backups/customer-site/ -name "customer_*.sql.gz" -mtime +7 -delete') | crontab -

(crontab -l 2>/dev/null; echo '0 4 * * 0 tar czf /opt/backups/customer-site/uploads_$(date +\%Y\%m\%d).tar.gz -C /opt/customer-site/backend/public uploads 2>/dev/null && find /opt/backups/customer-site/ -name "uploads_*.tar.gz" -mtime +28 -delete') | crontab -

crontab -l   # 验证：应看到上面两条
```

**手动立刻备份一次数据库：**

```bash
docker exec yousen-postgres pg_dump -U strapi strapi | gzip > /opt/backups/customer-site/manual_$(date +%Y%m%d_%H%M).sql.gz
ls -lh /opt/backups/customer-site/   # 确认文件生成了
```

### 7.2 恢复数据库（出大事时）

```bash
# 1. 找到要恢复的备份文件
ls -lh /opt/backups/customer-site/

# 2. 恢复（把 <文件名> 换成实际的）
gunzip < /opt/backups/customer-site/<文件名>.sql.gz | docker exec -i yousen-postgres psql -U strapi -d strapi

# 3. 重启后端
docker compose -f /opt/customer-site/docker-compose.yml restart backend
```

> ⚠️ 恢复是**覆盖式**的，恢复时间点之后的数据会丢。操作前先手动备份当前库（7.1 的手动命令）。

---

## 8. 常见故障速查

### 8.1 网站打不开（前台白屏/转圈）

```bash
# 1. 看容器
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. frontend 挂了 → 看日志找原因
docker compose -f /opt/customer-site/docker-compose.yml logs --tail 50 frontend

# 3. 尝试重启
docker compose -f /opt/customer-site/docker-compose.yml restart frontend
```

### 8.2 后台 /admin 打不开

```bash
docker compose -f /opt/customer-site/docker-compose.yml logs --tail 80 backend
```

常见报错对照：

| 日志关键字 | 原因 | 处理 |
|-----------|------|------|
| `ECONNREFUSED.*5432` | 数据库没起来 | `docker start yousen-postgres`，等 30 秒再重启 backend |
| `required-env` / `ENCRYPTION_KEY` | 缺环境变量 | 检查 `/opt/customer-site/.env` 是否齐全，对照 `.env.example` 补齐 |
| `bootstrap-health FAIL` | 启动自检没过 | 看具体哪项 fail，把日志发给技术负责人 |

### 8.3 AI 客服完全不回答（不是答错）

```bash
# 看后端日志
docker compose -f /opt/customer-site/docker-compose.yml logs --tail 100 backend | grep -i 'chat\|ai\|error'
```

常见原因：
- AI 的 API key 失效/欠费 → 登录后台（超管）→ 检查 AI 配置，或联系技术负责人换 key
- Redis 挂了 → 向量化队列停摆 → `docker start yousen-redis`

### 8.4 搜索没结果

```bash
# 看 meilisearch 是否活着
docker ps --filter name=meilisearch --format "{{.Names}} {{.Status}}"
curl -s http://localhost:7700/health
```

返回 `{"status":"available"}` 即正常。挂了：`docker start yousen-meilisearch`。

### 8.5 磁盘满了

```bash
df -h /
# 可用 < 10GB 时清理：
docker system prune -f
# 还不够 → 删旧备份（保留最近 3 个）
ls -t /opt/backups/customer-site/*.sql.gz | tail -n +4 | xargs rm -f
```

### 8.6 实在搞不定

把以下三样打包发给技术负责人：
1. `docker ps --format "table {{.Names}}\t{{.Status}}"` 的输出
2. `docker compose -f /opt/customer-site/docker-compose.yml logs --tail 100 backend` 的输出
3. 你**做了什么操作**、**期望什么结果**、**实际什么结果**的一句话描述

---

## 9. 速查表（收藏这一页）

| 我要做什么 | 命令/路径 |
|-----------|----------|
| 登录服务器 | `ssh ubuntu@124.223.1.67` |
| 切 root | `echo '密码' \| sudo -S -i` |
| 看容器状态 | `docker ps --format "table {{.Names}}\t{{.Status}}"` |
| 看后端日志 | `cd /opt/customer-site && docker compose logs --tail 100 backend` |
| 重启后端 | `cd /opt/customer-site && docker compose restart backend` |
| 部署上线 | 本地测试 → commit → rsync → 服务器 `docker compose up -d --build backend frontend` → 5 点验证 |
| 给客户开账号 | `docker compose exec backend npx tsx scripts/create-editor-account.ts --email X --password 'Y' --firstname Z` |
| 重置客户密码 | 同上命令（邮箱已存在即重置） |
| 停用客户账号 | 同命令加 `--deactivate` |
| 重建 AI 知识库 | `docker compose exec backend npx tsx scripts/rebuild-kb-from-published.ts` |
| 手动备份数据库 | `docker exec yousen-postgres pg_dump -U strapi strapi \| gzip > /opt/backups/customer-site/manual_$(date +%Y%m%d_%H%M).sql.gz` |
| 看资源占用 | `free -h && df -h / && docker stats --no-stream` |

---

> 📎 **详细技术参考**（需要更深入时看）：
> - 完整部署 Runbook：`docs/DEPLOY-RUNBOOK.md`（SSL、微信回调、离线部署、Central 运维）
> - 客户内容操作：`docs/operations/customer-handbook.md`
> - 后台冒烟清单：`docs/operations/admin-ui-smoke-checklist.md`
