export default (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;

  if (!user) {
    console.log('[Policy][is-authenticated] Denied - no user authenticated');
    return false;
  }

  console.log('[Policy][is-authenticated] Checking user:', user.email, 'role:', user.role?.name, 'result: true');
  return true;
};
