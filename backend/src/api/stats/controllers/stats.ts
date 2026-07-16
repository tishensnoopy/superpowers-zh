import type { Core } from '@strapi/strapi';

const LOG_PREFIX = '[Stats]';
const APPOINTMENT_UID = 'api::appointment.appointment';
const FEEDBACK_UID = 'api::feedback.feedback';
const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const FEEDBACK_STATUSES = ['pending', 'replied', 'closed'];
const TREND_DAYS = 7;

export default {
  async appointments(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [appointments] 收到预约统计请求`);

    try {
      const total = await strapi.db.query(APPOINTMENT_UID).count({});

      const byStatus: Record<string, number> = {};
      for (const status of APPOINTMENT_STATUSES) {
        byStatus[status] = await strapi.db.query(APPOINTMENT_UID).count({ where: { status } });
      }

      const dailyTrend: Array<{ date: string; count: number }> = [];
      const now = new Date();
      for (let i = TREND_DAYS - 1; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const count = await strapi.db.query(APPOINTMENT_UID).count({
          where: { createdAt: { $gte: dayStart.toISOString(), $lt: dayEnd.toISOString() } },
        });
        dailyTrend.push({ date: dayStart.toISOString().slice(0, 10), count });
      }

      ctx.body = { data: { total, byStatus, dailyTrend }, meta: {} };
      console.log(
        `${LOG_PREFIX} [appointments] ✅ total=${total}, 耗时=${Date.now() - startTime}ms`
      );
      return ctx.body;
    } catch (err) {
      console.error(
        `${LOG_PREFIX} [appointments] ❌ 失败:`,
        err instanceof Error ? err.message : err
      );
      throw err;
    }
  },

  async feedbacks(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [feedbacks] 收到反馈统计请求`);

    try {
      const total = await strapi.db.query(FEEDBACK_UID).count({});

      const byStatus: Record<string, number> = {};
      for (const status of FEEDBACK_STATUSES) {
        byStatus[status] = await strapi.db.query(FEEDBACK_UID).count({ where: { status } });
      }

      ctx.body = { data: { total, byStatus }, meta: {} };
      console.log(
        `${LOG_PREFIX} [feedbacks] ✅ total=${total}, 耗时=${Date.now() - startTime}ms`
      );
      return ctx.body;
    } catch (err) {
      console.error(
        `${LOG_PREFIX} [feedbacks] ❌ 失败:`,
        err instanceof Error ? err.message : err
      );
      throw err;
    }
  },

  async overview(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [overview] 收到总览统计请求`);

    try {
      const uids = [
        'api::appointment.appointment',
        'api::feedback.feedback',
        'api::product.product',
        'api::news-article.news-article',
        'api::teacher.teacher',
        'api::knowledge-base.knowledge-base',
      ];

      const entries = await Promise.all(
        uids.map(async (uid) => {
          const key = uid.split('.')[1];
          const count = await strapi.db.query(uid).count({});
          return [key, count] as [string, number];
        })
      );

      const counts = Object.fromEntries(entries);
      ctx.body = { data: counts, meta: {} };
      console.log(
        `${LOG_PREFIX} [overview] ✅ counts=${JSON.stringify(counts)}, 耗时=${Date.now() - startTime}ms`
      );
      return ctx.body;
    } catch (err) {
      console.error(
        `${LOG_PREFIX} [overview] ❌ 失败:`,
        err instanceof Error ? err.message : err
      );
      throw err;
    }
  },
} satisfies Core.Controller;
