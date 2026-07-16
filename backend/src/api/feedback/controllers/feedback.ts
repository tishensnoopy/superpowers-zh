import type { Core } from '@strapi/strapi';

const UID = 'api::feedback.feedback';
const LOG_PREFIX = '[Feedback]';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const NAME_MAX_LENGTH = 100;
const SUBJECT_MAX_LENGTH = 200;
const VALID_STATUSES = ['pending', 'replied', 'closed'];

// 简单邮箱校验：Strapi schema 已声明 type=email，这里做前置校验避免脏数据入库
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async create(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [create] 收到反馈提交请求`);

    try {
      const data = ctx.request.body?.data || {};
      const { name, email, message, phone, subject, sourcePage } = data;

      // 必填字段校验
      const missing: string[] = [];
      if (!name || typeof name !== 'string' || !name.trim()) missing.push('name');
      if (!email || typeof email !== 'string' || !email.trim()) missing.push('email');
      if (!message || typeof message !== 'string' || !message.trim()) missing.push('message');

      if (missing.length > 0) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: 缺少必填字段 ${missing.join(', ')}`);
        return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);
      }

      // 长度校验
      if (name.length > NAME_MAX_LENGTH) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: name 长度=${name.length} 超过 ${NAME_MAX_LENGTH}`);
        return ctx.badRequest(`name exceeds ${NAME_MAX_LENGTH} characters`);
      }

      if (subject && subject.length > SUBJECT_MAX_LENGTH) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: subject 长度=${subject.length} 超过 ${SUBJECT_MAX_LENGTH}`);
        return ctx.badRequest(`subject exceeds ${SUBJECT_MAX_LENGTH} characters`);
      }

      // 邮箱格式校验
      if (!EMAIL_REGEX.test(email)) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: 邮箱格式错误 email=${email.substring(0, 3)}***`);
        return ctx.badRequest('Invalid email format');
      }

      // 记录客户端信息
      const clientIp = (ctx.request as any).client?.ip || ctx.request.ip || 'unknown';
      const userAgent = ctx.request.headers['user-agent'] || 'unknown';

      console.log(`${LOG_PREFIX} [create] 客户端信息: ip=${clientIp}, userAgent长度=${userAgent.length}`);

      const payload = {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        phone: phone || undefined,
        subject: subject || undefined,
        sourcePage: sourcePage || undefined,
        status: 'pending',
        ipAddress: clientIp,
        userAgent,
      };

      const doc = await strapi.documents(UID).create({ data: payload });

      ctx.body = { data: doc, meta: {} };
      const duration = Date.now() - startTime;
      console.log(`${LOG_PREFIX} [create] ✅ 创建成功, id=${doc?.id}, 耗时=${duration}ms`);
      return ctx.body;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`${LOG_PREFIX} [create] ❌ 创建失败, 耗时=${duration}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async find(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [find] 收到列表查询请求`);

    try {
      const query = ctx.query as any;
      const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
      const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, parseInt(query.pageSize || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
      );

      // 解析筛选条件
      const filters: any = {};
      if (query.filters && typeof query.filters === 'object') {
        for (const key of ['status', 'name', 'email']) {
          const v = (query.filters as any)[key];
          if (v !== undefined && v !== null && v !== '') {
            filters[key] = typeof v === 'object' ? v : { $eq: v };
          }
        }
      } else {
        for (const key of ['status', 'name', 'email']) {
          const flatKey = `filters[${key}]`;
          if (query[flatKey] !== undefined && query[flatKey] !== '') {
            filters[key] = { $eq: query[flatKey] };
          }
        }
      }

      const sort = query.sort
        ? Array.isArray(query.sort)
          ? query.sort
          : [query.sort]
        : [{ createdAt: 'desc' }];

      console.log(`${LOG_PREFIX} [find] 查询参数: page=${page}, pageSize=${pageSize}, filters=${JSON.stringify(filters)}`);

      const [results, total] = await Promise.all([
        strapi.documents(UID).findMany({
          filters,
          sort: sort as any,
          page,
          pageSize,
        }),
        strapi.db.query(UID).count({ where: filters }),
      ]);

      const pageCount = Math.ceil(total / pageSize) || 1;

      ctx.body = {
        data: results || [],
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount,
            total,
          },
        },
      };

      const duration = Date.now() - startTime;
      console.log(`${LOG_PREFIX} [find] ✅ 查询成功, 返回${results?.length || 0}条/共${total}条, 耗时=${duration}ms`);
      return ctx.body;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`${LOG_PREFIX} [find] ❌ 查询失败, 耗时=${duration}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [findOne] 收到详情查询请求`);

    try {
      const { documentId } = ctx.params as any;

      if (!documentId) {
        return ctx.badRequest('Missing documentId');
      }

      console.log(`${LOG_PREFIX} [findOne] 查询: documentId=${documentId}`);

      const result = await strapi.documents(UID).findOne({ documentId });

      if (!result) {
        console.warn(`${LOG_PREFIX} [findOne] 未找到: documentId=${documentId}`);
        return ctx.notFound('Feedback not found');
      }

      ctx.body = { data: result, meta: {} };
      const duration = Date.now() - startTime;
      console.log(`${LOG_PREFIX} [findOne] ✅ 查询成功, documentId=${documentId}, 耗时=${duration}ms`);
      return ctx.body;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`${LOG_PREFIX} [findOne] ❌ 查询失败, 耗时=${duration}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [update] 收到更新请求`);

    try {
      const { documentId } = ctx.params as any;
      const data = ctx.request.body?.data || {};

      if (!documentId) {
        return ctx.badRequest('Missing documentId');
      }

      // 仅允许更新 status 和 reply 字段，其余字段（name/email/message 等）不可变
      const updateData: any = {};
      if (data.status !== undefined) {
        if (!VALID_STATUSES.includes(data.status)) {
          console.warn(`${LOG_PREFIX} [update] 校验失败: 非法 status=${data.status}`);
          return ctx.badRequest(`Invalid status value. Allowed: ${VALID_STATUSES.join(', ')}`);
        }
        updateData.status = data.status;
      }
      if (data.reply !== undefined) {
        updateData.reply = data.reply;
      }

      // 先确认目标存在
      const existing = await strapi.documents(UID).findOne({ documentId });
      if (!existing) {
        console.warn(`${LOG_PREFIX} [update] 未找到: documentId=${documentId}`);
        return ctx.notFound('Feedback not found');
      }

      console.log(`${LOG_PREFIX} [update] 更新: documentId=${documentId}, fields=${Object.keys(updateData).join(',')}`);

      const result = await strapi.documents(UID).update({
        documentId,
        data: updateData,
      });

      ctx.body = { data: result, meta: {} };
      const duration = Date.now() - startTime;
      console.log(`${LOG_PREFIX} [update] ✅ 更新成功, documentId=${documentId}, 耗时=${duration}ms`);
      return ctx.body;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`${LOG_PREFIX} [update] ❌ 更新失败, 耗时=${duration}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },
} satisfies Core.Controller;
