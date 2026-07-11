export default ({ strapi }: { strapi: any }) => {
  async function initializeRoles() {
    console.log('[RBAC] initializeRoles() called');
    try {
      const roles = await strapi.db.query('plugin::users-permissions.role').findMany();
      console.log('[RBAC] initializeRoles() found existing roles:', roles.map(r => r.name));

      const clientAdminExists = roles.some(r => r.name === 'client-admin');
      if (!clientAdminExists) {
        console.log('[RBAC] initializeRoles() creating client-admin role');

        const clientAdminRole = await strapi.db.query('plugin::users-permissions.role').create({
          data: {
            name: 'client-admin',
            description: 'Client administrator - can manage all content types except user management',
            type: 'private',
          },
        });
        console.log('[RBAC] initializeRoles() created client-admin role with id:', clientAdminRole.id);

        await configureClientAdminPermissions(clientAdminRole.id);
        console.log('[RBAC] initializeRoles() configured client-admin permissions');
      } else {
        console.log('[RBAC] initializeRoles() client-admin role already exists');
      }

      return roles;
    } catch (err) {
      console.error('[RBAC] initializeRoles() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  }

  async function configureClientAdminPermissions(roleId: number) {
    console.log('[RBAC] configureClientAdminPermissions() called for role:', roleId);
    try {
      const allPermissions = await strapi.db.query('plugin::users-permissions.permission').findMany({
        populate: ['action'],
      });

      const contentTypesToAllow = [
        'api::site-settings.site-settings',
        'api::navigation.navigation',
        'api::footer.footer',
        'api::page.page',
        'api::product.product',
        'api::product-category.product-category',
        'api::product-spec.product-spec',
        'api::faq-item.faq-item',
        'api::knowledge-base.knowledge-base',
      ];

      const allowedPermissions = allPermissions.filter(perm => {
        const action = perm.action?.name;
        if (!action) return false;

        const isUserManagement = action.startsWith('plugin::users-permissions');
        if (isUserManagement) return false;

        const contentType = action.split('.')[1];
        const contentTypeFull = action.startsWith('api::') ? action : `api::${action.split('.')[0]}.${contentType}`;
        return contentTypesToAllow.some(ct => action.includes(ct.split('.')[1]));
      });

      console.log('[RBAC] configureClientAdminPermissions() found', allowedPermissions.length, 'permissions to allow');

      for (const perm of allowedPermissions) {
        try {
          await strapi.db.query('plugin::users-permissions.permission').update({
            where: { id: perm.id },
            data: {
              role: roleId,
            },
          });
        } catch (err) {
          console.warn('[RBAC] configureClientAdminPermissions() failed to assign permission:', perm.action?.name);
        }
      }

      console.log('[RBAC] configureClientAdminPermissions() completed');
    } catch (err) {
      console.error('[RBAC] configureClientAdminPermissions() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  }

  return {
    initializeRoles,
    configureClientAdminPermissions,
  };
};
