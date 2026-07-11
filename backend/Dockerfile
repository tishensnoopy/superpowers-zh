FROM node:22-alpine AS builder

WORKDIR /opt/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /opt/app

ENV NODE_ENV=production

COPY --from=builder /opt/app/dist ./dist
COPY --from=builder /opt/app/node_modules ./node_modules

RUN addgroup -g 1001 strapi \
    && adduser -u 1001 -G strapi -s /bin/sh -D strapi \
    && chown -R strapi:strapi /opt/app

USER strapi

EXPOSE 1337

CMD ["node", "dist/main.js"]
