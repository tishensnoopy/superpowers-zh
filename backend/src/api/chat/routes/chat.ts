/**
 * Custom chat API routes (not the default CRUD router).
 *
 * These are public customer-facing endpoints used by the AI customer service
 * widget on the 佑森小课堂 site. `auth: false` is intentional — sessions are
 * identified by a generated sessionId, not a Strapi user.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/chat/start',
      handler: 'chat.startSession',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/chat/message',
      handler: 'chat.sendMessage',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/chat/transfer',
      handler: 'chat.transferToHuman',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/chat/history/:sessionId',
      handler: 'chat.getHistory',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/chat/feedback',
      handler: 'chat.submitFeedback',
      config: {
        auth: false,
      },
    },
  ],
};
