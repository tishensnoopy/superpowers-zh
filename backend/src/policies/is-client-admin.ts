export default (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;

  if (!user) {
    console.log('[Policy][is-client-admin] Denied - no user authenticated');
    return false;
  }

  const isSuperAdmin = user.role?.name === 'Super Admin';
  const isClientAdmin = user.role?.name === 'client-admin';
  const hasAccess = isSuperAdmin || isClientAdmin;

  console.log('[Policy][is-client-admin] Checking user:', user.email, 'role:', user.role?.name, 'result:', hasAccess);

  return hasAccess;
};
