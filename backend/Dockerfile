# ============================================================================
# Strapi v5 后端 Dockerfile
# 多阶段构建：deps → builder → runner
# ============================================================================

# ---- 阶段 1: 安装完整依赖（含编译工具）----
FROM node:22-alpine AS deps
WORKDIR /opt/app

# 国内镜像源加速（Alpine + npm）
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
    && npm config set registry https://registry.npmmirror.com

# 安装原生模块编译工具（better-sqlite3 需要 python3 + make + g++）
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

# ---- 阶段 2: 构建 Strapi ----
FROM node:22-alpine AS builder
WORKDIR /opt/app

RUN npm config set registry https://registry.npmmirror.com

# 复制已编译的 node_modules（含 better-sqlite3 原生模块）
COPY --from=deps /opt/app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN npm run build

# 将编译后的 config/*.js 复制到 config/ 目录（Strapi 生产模式只加载 .js）
RUN cp dist/config/*.js config/

# 移除 devDependencies，仅保留生产依赖
RUN npm prune --production

# ---- 阶段 3: 运行时（不需要编译工具）----
FROM node:22-alpine AS runner
WORKDIR /opt/app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

# 国内镜像源 + 运行时依赖（wget 用于健康检查）
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
    && apk add --no-cache wget

# 先创建非 root 用户
RUN addgroup -g 1001 strapi \
    && adduser -u 1001 -G strapi -s /bin/sh -D strapi \
    && mkdir -p /opt/app/.tmp /opt/app/public/uploads

# 使用 --chown 直接在复制时设置权限，避免 chown -R 遍历几万个小文件
COPY --chown=strapi:strapi --from=builder /opt/app/node_modules ./node_modules
COPY --chown=strapi:strapi --from=builder /opt/app/dist ./dist
COPY --chown=strapi:strapi --from=builder /opt/app/config ./config
COPY --chown=strapi:strapi --from=builder /opt/app/src ./src
COPY --chown=strapi:strapi --from=builder /opt/app/public ./public
COPY --chown=strapi:strapi --from=builder /opt/app/scripts ./scripts
COPY --chown=strapi:strapi --from=builder /opt/app/database ./database
COPY --chown=strapi:strapi --from=builder /opt/app/package.json ./package.json
# tsconfig.json 必须存在，否则 Strapi start 会从 src/ 加载 .ts 源码而非 dist/ 编译产物
COPY --chown=strapi:strapi --from=builder /opt/app/tsconfig.json ./tsconfig.json

USER strapi

EXPOSE 1337

# 健康检查：Strapi 提供 /_health 端点
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:1337/_health || exit 1

CMD ["npm", "run", "start"]
