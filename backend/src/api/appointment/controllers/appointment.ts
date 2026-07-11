import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::appointment.appointment', ({ strapi }) => ({
  async create(ctx) {
    console.log('[Appointment] create() called');

    const { childName, parentName, phone } = ctx.request.body.data || {};

    if (!childName || !parentName || !phone) {
      return ctx.badRequest('Missing required fields: childName, parentName, phone');
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return ctx.badRequest('Invalid phone number format');
    }

    const clientIp = (ctx.request as any).client?.ip || ctx.request.ip || 'unknown';
    const userAgent = ctx.request.headers['user-agent'] || 'unknown';

    const recentCount = await strapi.db.query('api::appointment.appointment').count({
      where: {
        ipAddress: clientIp,
        createdAt: { $gte: new Date(Date.now() - 3600000) },
      },
    });

    if (recentCount >= 5) {
      return ctx.tooManyRequests('Rate limit exceeded: max 5 submissions per hour');
    }

    ctx.request.body.data = {
      ...ctx.request.body.data,
      status: 'pending',
      ipAddress: clientIp,
      userAgent: userAgent,
    };

    const result = await super.create(ctx);
    console.log('[Appointment] create() completed, id:', result.data?.id);
    return result;
  },

  async find(ctx) {
    console.log('[Appointment] find() called');
    return super.find(ctx);
  },

  async findOne(ctx) {
    console.log('[Appointment] findOne() called, id:', ctx.params.id);
    return super.findOne(ctx);
  },
}));
