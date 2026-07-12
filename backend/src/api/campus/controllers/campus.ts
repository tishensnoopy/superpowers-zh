import type { Core } from '@strapi/strapi';

const UID = 'api::campus.campus';

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

function transformTeacherRef(teacher: any) {
  if (!teacher) return null;
  const { id, documentId, avatar, ...rest } = teacher;
  const attributes: any = { ...rest };
  if (avatar !== undefined) {
    attributes.avatar = wrapMedia(avatar);
  }
  return { id, documentId, attributes };
}

function transformCampus(campus: any) {
  if (!campus) return null;
  const { id, documentId, coverImage, gallery, teachers, ...rest } = campus;
  const attributes: any = { ...rest };
  if (coverImage !== undefined) {
    attributes.coverImage = wrapMedia(coverImage);
  }
  if (gallery !== undefined) {
    attributes.gallery = gallery
      ? { data: gallery.map((g: any) => wrapMedia(g)) }
      : { data: [] };
  }
  if (teachers !== undefined) {
    if (Array.isArray(teachers)) {
      attributes.teachers = { data: teachers.map(transformTeacherRef) };
    } else if (teachers && typeof teachers === 'object' && 'count' in teachers) {
      attributes.teachers = teachers;
    } else {
      attributes.teachers = { data: [] };
    }
  }
  return { id, documentId, attributes };
}

export default {
  async find(ctx) {
    const { filters, sort } = ctx.query as any;

    const entityFilters: any = {};
    if (filters?.slug?.$eq) {
      entityFilters.slug = { $eq: filters.slug.$eq };
    }

    const sortArr = sort
      ? (Array.isArray(sort) ? sort : [sort])
      : [{ sortOrder: 'asc' }];

    const campuses = await strapi.documents(UID).findMany({
      filters: entityFilters,
      sort: sortArr as any,
      populate: {
        coverImage: true,
        gallery: true,
        teachers: {
          populate: { avatar: true },
        },
      },
      status: 'published',
    });

    const data = (campuses || []).map(transformCampus);

    ctx.body = {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          pageCount: 1,
          total: data.length,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const campus = await strapi.documents(UID).findOne({
      documentId: id,
      populate: {
        coverImage: true,
        gallery: true,
        teachers: {
          populate: { avatar: true },
        },
      },
      status: 'published',
    });

    if (!campus) {
      ctx.notFound('Campus not found');
      return;
    }

    ctx.body = { data: transformCampus(campus), meta: {} };
  },
} satisfies Core.Controller;
