import type { Core } from '@strapi/strapi';

const UID = 'api::product-category.product-category';

export default {
  async find(ctx) {
    const { locale } = ctx.query as any;
    const categories = await strapi.documents(UID).findMany({
      populate: { parent: true, children: true, image: true },
      sort: { position: 'asc' },
      ...(locale ? { locale } : {}),
    });

    ctx.body = {
      data: categories,
      meta: { pagination: { page: 1, pageSize: categories.length, pageCount: 1, total: categories.length } },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const { locale } = ctx.query as any;
    const category = await strapi.documents(UID).findOne({
      documentId: id,
      populate: { parent: true, children: true, image: true },
      ...(locale ? { locale } : {}),
    });

    ctx.body = { data: category, meta: {} };
  },

  async getCategoryTree(ctx) {
    const tree = await strapi.service('api::product-category.product-category').getCategoryTree();
    ctx.body = { data: tree, meta: {} };
  },

  async reorder(ctx) {
    const { items } = ctx.request.body as { items: { id: string; position: number }[] };
    const result = await strapi.service('api::product-category.product-category').reorder(items);
    ctx.body = { data: result, meta: {} };
  },

  async move(ctx) {
    const { ids, newParentId } = ctx.request.body as { ids: string[]; newParentId: string | null };

    if (newParentId !== null) {
      const service = strapi.service('api::product-category.product-category');
      for (const id of ids) {
        const isCycle = await service.hasDescendant(id, newParentId);
        if (isCycle) {
          ctx.status = 409;
          ctx.body = {
            error: {
              status: 409,
              name: 'CircularReference',
              message: `Cannot move category ${id} under its own descendant`,
            },
          };
          return;
        }
      }
    }

    const result = await strapi.service('api::product-category.product-category').move(ids, newParentId);
    ctx.body = { data: result, meta: {} };
  },

  async create(ctx) {
    try {
      const { data } = ctx.request.body as { data: any };
      const result = await strapi.documents(UID).create({ data });
      ctx.body = { data: result, meta: {} };
    } catch (err: any) {
      if (err?.code === '23505' || /duplicate key/i.test(err?.message || '')) {
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: 'DuplicateSlug',
            message: 'Slug already exists. Choose a different slug.',
          },
        };
        return;
      }
      throw err;
    }
  },

  async update(ctx) {
    const { id } = ctx.params;
    try {
      const { data } = ctx.request.body as { data: any };
      const result = await strapi.documents(UID).update({ documentId: id, data });
      ctx.body = { data: result, meta: {} };
    } catch (err: any) {
      if (err?.code === '23505' || /duplicate key/i.test(err?.message || '')) {
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: 'DuplicateSlug',
            message: 'Slug already exists. Choose a different slug.',
          },
        };
        return;
      }
      throw err;
    }
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const children = await strapi.db.query(UID).findMany({
      where: { parent: { documentId: id } },
      select: ['documentId'],
    });

    if (children.length > 0) {
      ctx.status = 409;
      ctx.body = {
        error: {
          status: 409,
          name: 'HasChildren',
          message: 'Cannot delete category with children. Remove children first.',
        },
      };
      return;
    }

    const result = await strapi.documents(UID).delete({ documentId: id });
    ctx.body = { data: result, meta: {} };
  },
} satisfies Core.Controller;
