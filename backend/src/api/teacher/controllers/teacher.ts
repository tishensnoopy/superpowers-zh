import type { Core } from '@strapi/strapi';

const UID = 'api::teacher.teacher';

function wrapItem(item: any) {
  if (!item) return null;
  const { id, documentId, ...rest } = item;
  return { id, documentId, attributes: rest };
}

function wrapMedia(media: any) {
  if (!media) return { data: null };
  const { id, documentId, ...attributes } = media;
  return { data: { id, documentId, attributes } };
}

function transformTeacher(teacher: any) {
  if (!teacher) return null;
  const { id, documentId, campus, avatar, ...rest } = teacher;
  const attributes: any = { ...rest };
  if (avatar !== undefined) {
    attributes.avatar = wrapMedia(avatar);
  }
  if (campus !== undefined) {
    attributes.campus = campus ? { data: wrapItem(campus) } : { data: null };
  }
  return { id, documentId, attributes };
}

export default {
  async find(ctx) {
    const { filters, sort, page, pageSize } = ctx.query as any;

    const entityFilters: any = {};
    if (filters?.subject) {
      entityFilters.subject = { $eq: filters.subject };
    }
    if (filters?.isFeatured !== undefined) {
      entityFilters.isFeatured = { $eq: filters.isFeatured === 'true' };
    }

    const campusSlug = filters?.campus?.slug?.$eq || filters?.campusSlug;
    if (campusSlug) {
      entityFilters.campus = { slug: { $eq: campusSlug } };
    }

    const sortArr = sort ? (Array.isArray(sort) ? sort : [sort]) : [{ sortOrder: 'asc' }];

    const limit = parseInt(pageSize as string, 10) || 25;
    const start = ((parseInt(page as string, 10) || 1) - 1) * limit;

    const [teachers, total] = await Promise.all([
      strapi.documents(UID).findMany({
        filters: entityFilters,
        sort: sortArr as any,
        limit,
        start,
        populate: { campus: true, avatar: true },
        status: 'published',
      }),
      strapi.documents(UID).count({
        filters: entityFilters,
        status: 'published',
      }),
    ]);

    const data = (teachers || []).map(transformTeacher);

    ctx.body = {
      data,
      meta: {
        pagination: {
          page: parseInt(page as string, 10) || 1,
          pageSize: limit,
          pageCount: Math.ceil(total / limit),
          total,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const teacher = await strapi.documents(UID).findOne({
      documentId: id,
      populate: { campus: true, avatar: true },
      status: 'published',
    });

    if (!teacher) {
      ctx.notFound('Teacher not found');
      return;
    }

    ctx.body = { data: transformTeacher(teacher), meta: {} };
  },
} satisfies Core.Controller;
