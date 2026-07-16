import type { Core } from '@strapi/strapi';

const UID = 'api::appointment.appointment';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3600000;
const LOG_PREFIX = '[Appointment]';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export default {
  async create(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [create] 收到预约提交请求`);

    try {
      const { parentName, childName, phone, campus, name } = ctx.request.body.data || {};

      // 向后兼容：旧客户端发送 name，新客户端发送 parentName
      const effectiveParentName = parentName || name;

      console.log(`${LOG_PREFIX} [create] 请求数据:`, {
        parentName: effectiveParentName ? `${effectiveParentName.substring(0, 1)}***` : 'empty',
        childName: childName ? `${childName.substring(0, 1)}***` : 'empty',
        phone: phone ? `${phone.substring(0, 3)}****${phone.substring(7)}` : 'empty',
        campus: campus || 'empty',
      });

      if (!effectiveParentName || !childName || !phone || !campus) {
        const missing: string[] = [];
        if (!effectiveParentName) missing.push('parentName');
        if (!childName) missing.push('childName');
        if (!phone) missing.push('phone');
        if (!campus) missing.push('campus');
        console.warn(`${LOG_PREFIX} [create] 校验失败: 缺少必填字段 ${missing.join(', ')}`);
        return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);
      }

      // 向后兼容：旧客户端只发送 name，将其映射到 parentName 字段
      if (!parentName && name) {
        ctx.request.body.data.parentName = name;
      }

      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: 手机号格式错误, 长度=${phone.length}`);
        return ctx.badRequest('Invalid phone number format');
      }

      const validCampuses = ['chaoyang', 'haidian', 'xicheng', 'fengtai'];
      if (!validCampuses.includes(campus)) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: 无效校区=${campus}`);
        return ctx.badRequest('Invalid campus value');
      }

      const clientIp = (ctx.request as any).client?.ip || ctx.request.ip || 'unknown';
      const userAgent = ctx.request.headers['user-agent'] || 'unknown';

      console.log(`${LOG_PREFIX} [create] 客户端信息: ip=${clientIp}, userAgent长度=${userAgent.length}`);

      const recentCount = await strapi.db.query(UID).count({
        where: {
          ipAddress: clientIp,
          createdAt: { $gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
        },
      });

      console.log(`${LOG_PREFIX} [create] 频率检查: 近1小时提交数=${recentCount}/${RATE_LIMIT_MAX}`);

      if (recentCount >= RATE_LIMIT_MAX) {
        console.warn(`${LOG_PREFIX} [create] 频率限制触发: ip=${clientIp}`);
        return ctx.tooManyRequests('Rate limit exceeded: max 5 submissions per hour');
      }

      ctx.request.body.data = {
        ...ctx.request.body.data,
        status: 'pending',
        ipAddress: clientIp,
        userAgent: userAgent,
      };

      const doc = await strapi.documents(UID).create({
        data: ctx.request.body.data,
      });

      ctx.body = { data: doc, meta: {} };
      const duration = Date.now() - startTime;
      console.log(`${LOG_PREFIX} [create] ✅ 创建成功, id=${doc?.id}, 耗时=${duration}ms`);
      return ctx.body;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`${LOG_PREFIX} [create] ❌ 创建失败, 耗时=${duration}ms:`, err instanceof Error ? err.message : err);
      if (err instanceof Error) {
        console.error(`${LOG_PREFIX} [create] 错误堆栈:`, err.stack);
      }
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

      // 解析筛选条件：支持 ctx.query.filters 对象形式或扁平 filters[xxx]=yyy 形式
      const filters: any = {};
      if (query.filters && typeof query.filters === 'object') {
        for (const key of ['status', 'campus', 'parentName', 'phone']) {
          const v = (query.filters as any)[key];
          if (v !== undefined && v !== null && v !== '') {
            filters[key] = typeof v === 'object' ? v : { $eq: v };
          }
        }
      } else {
        for (const key of ['status', 'campus', 'parentName', 'phone']) {
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

      const result = await strapi.documents(UID).findOne({
        documentId,
      });

      if (!result) {
        console.warn(`${LOG_PREFIX} [findOne] 未找到: documentId=${documentId}`);
        return ctx.notFound('Appointment not found');
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

  async export(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [export] 收到 CSV 导出请求`);

    try {
      const results = await strapi.documents(UID).findMany({
        limit: 1000,
        sort: 'createdAt:desc',
      });

      const headers = [
        'documentId',
        'parentName',
        'childName',
        'phone',
        'campus',
        'course',
        'preferredDate',
        'status',
        'createdAt',
      ];
      const csvRows = [headers.join(',')];

      for (const r of results) {
        const row = [
          r.documentId || '',
          `"${(r.parentName || '').replace(/"/g, '""')}"`,
          `"${(r.childName || '').replace(/"/g, '""')}"`,
          r.phone || '',
          r.campus || '',
          `"${(r.course || '').replace(/"/g, '""')}"`,
          r.preferredDate || '',
          r.status || '',
          r.createdAt ? new Date(r.createdAt).toISOString() : '',
        ];
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');

      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set(
        'Content-Disposition',
        `attachment; filename="appointments_${Date.now()}.csv"`
      );
      ctx.body = csv;

      console.log(
        `${LOG_PREFIX} [export] ✅ 导出 ${results.length} 条, 耗时=${Date.now() - startTime}ms`
      );
      return ctx.body;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(
        `${LOG_PREFIX} [export] ❌ 导出失败, 耗时=${duration}ms:`,
        err instanceof Error ? err.message : err
      );
      throw err;
    }
  },
} satisfies Core.Controller;
