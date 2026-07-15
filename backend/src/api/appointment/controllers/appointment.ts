import { factories } from '@strapi/strapi';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3600000;
const LOG_PREFIX = '[Appointment]';

export default factories.createCoreController('api::appointment.appointment', ({ strapi }) => ({
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

      const recentCount = await strapi.db.query('api::appointment.appointment').count({
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

      const result = await super.create(ctx);
      const duration = Date.now() - startTime;
      console.log(`${LOG_PREFIX} [create] ✅ 创建成功, id=${result.data?.id}, 耗时=${duration}ms`);
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`${LOG_PREFIX} [create] ❌ 创建失败, 耗时=${duration}ms:`, err instanceof Error ? err.message : err);
      if (err instanceof Error) {
        console.error(`${LOG_PREFIX} [create] 错误堆栈:`, err.stack);
      }
      throw err;
    }
  },
}));
