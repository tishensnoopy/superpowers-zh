# 规范开发流程

> **创建日期：** 2026-07-22
> **适用范围：** superpowers-zh 项目所有后端开发工作
> **核心原则：** 所有后端开发工作必须在本地开发环境中完成，经单元测试、集成测试和功能测试验证通过后，方可通过版本控制系统部署至服务器环境。

---

## 1. 技术依据

Strapi v5 的核心配置机制（模型关系定义、权限策略设置、内容类型配置）仅在 development mode 下允许创建和修改。直接在生产服务器环境进行开发操作会导致：

- **配置变更无法持久化**：`docker compose up -d` 重建容器会丢失 `docker cp` 的文件
- **版本控制缺失**：服务器上的改动没有 git 记录
- **系统状态不一致**：本地、GitHub、服务器三方代码不同步

---

## 2. 环境信息

| 环境 | 地址 | 用途 | Strapi 模式 | Git |
|------|------|------|------------|-----|
| 本地 | `/home/tishensnoopy/project/superpowers-zh` | 开发 + 测试 | development | ✅ origin/main |
| 测试服务器 | `124.223.1.67` | 集成验证 | production | git archive 同步 |
| 客户服务器 | `121.196.210.191` / `yoosen.cn` | 生产 | production | git archive 同步 |
| GitHub | `git@github.com:tishensnoopy/superpowers-zh.git` | 中央仓库 | N/A | SSH 协议 |

### SSH 凭据
- 测试服务器：`sshpass -p 'Ysxkt12345' ssh root@124.223.1.67`
- 客户服务器：`sshpass -p 'Ysxkt12345' ssh root@121.196.210.191`
- GitHub：SSH key 认证（`~/.ssh/id_ed25519_github`）

---

## 3. 标准开发流程

### 3.1 开发阶段（本地）

```bash
# 1. 启动本地开发环境
cd /home/tishensnoopy/project/superpowers-zh
docker compose up -d  # Strapi 以 development mode 运行

# 2. 修改代码 / schema / 配置
# （在 backend/src/ 下编辑）

# 3. 运行单元测试
cd backend && npx vitest run

# 4. 集成测试：手动在 http://localhost:1337/admin 验证功能

# 5. 提交
git add <修改的文件>
git commit -m "feat/fix/docs(chore): 描述"
```

### 3.2 部署阶段

```bash
# 1. 推送到 GitHub
git push origin main

# 2. 测试服务器部署
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67
cd /opt/customer-site
# 方案 A（标准）：git pull + 重建容器
git pull origin main
docker compose up -d --build backend
# 方案 B（git fetch 超时时）：git archive 同步
# 在本地执行 git archive + scp，详见下方"降级方案"

# 3. 验证测试服务器
curl -sI http://124.223.1.67:1337/_health  # 预期 204
docker logs yousen-backend --tail 10  # 检查无错误

# 4. 客户服务器部署
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191
cd /opt/customer-site
# 方案 A（标准）：git pull + 重建容器
git pull origin main
docker compose up -d --build backend
# 方案 B（build 超时时）：docker cp + strapi build
# 详见下方"降级方案"

# 5. 验证客户服务器
curl -sI https://yoosen.cn  # 预期 200
docker logs yousen-backend --tail 10  # 检查无错误
```

### 3.3 降级方案

#### 场景 A：服务器 git fetch 超时（网络限制）

```bash
# 在本地打包最新代码
git archive --format=tar.gz HEAD --prefix="" -o /tmp/customer-site-latest.tar.gz

# 传输到服务器
sshpass -p 'Ysxkt12345' scp /tmp/customer-site-latest.tar.gz root@<服务器IP>:/tmp/

# 在服务器解压（.env 不在 tar 中，安全保留）
ssh root@<服务器IP> 'cd /opt/customer-site && tar xzf /tmp/customer-site-latest.tar.gz'

# 重建容器
ssh root@<服务器IP> 'cd /opt/customer-site && docker compose up -d --build backend'
```

#### 场景 B：客户服务器 docker compose build 超时

```bash
# 用旧镜像启动容器
ssh root@121.196.210.191 'cd /opt/customer-site && docker compose up -d backend'

# 复制更新的源代码到容器
ssh root@121.196.210.191 'docker cp backend/src yousen-backend:/opt/app/'

# 在容器内编译 TS → dist/
ssh root@121.196.210.191 'docker exec -u root yousen-backend mkdir -p /opt/app/.strapi && docker exec -u root yousen-backend chown strapi:strapi /opt/app/.strapi'
ssh root@121.196.210.191 'docker exec -u strapi yousen-backend sh -c "cd /opt/app && npx strapi build"'

# 重启容器让新代码生效
ssh root@121.196.210.191 'docker restart yousen-backend'
```

---

## 4. 禁止事项

- ❌ **禁止**直接在服务器上修改代码
- ❌ **禁止**使用 `docker cp` 部署代码（仅作为 build 超时的降级方案）
- ❌ **禁止**在服务器上运行 `strapi build` 代替镜像重建（仅作为降级方案）
- ❌ **禁止**跳过测试直接部署
- ❌ **禁止**不通过 GitHub 直接在服务器间同步代码

---

## 5. 版本控制规范

### 5.1 提交规范（Conventional Commits）
```
feat(scope): 新功能
fix(scope): BUG 修复
docs(scope): 文档变更
chore(scope): 构建/工具/配置变更
```

### 5.2 分支策略
- `main`：主分支，保持可部署状态
- 功能开发：从 `main` 切出 `feat/<feature-name>` 分支
- 合并前需通过本地测试

### 5.3 SSH Key 管理
- 每台环境使用独立的 SSH key（本地 / 测试服务器 / 客户服务器）
- 公钥添加到 GitHub Settings → SSH keys
- SSH config 配置 `IdentityFile` 指定正确的密钥
