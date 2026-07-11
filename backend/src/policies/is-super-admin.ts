export default (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;

  if (!user) {
    console.log('[Policy][is-super-admin] Denied - no user authenticated');
    return false;
  }

  const isSuperAdmin = user.role?.name === 'Super Admin';
  console.log('[Policy][is-super-admin] Checking user:', user.email, 'role:', user.role?.name, 'result:', isSuperAdmin);

  return isSuperAdmin;
};
