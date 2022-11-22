import { callJNAPRouter } from '../handlers/linksys_jnap_router';

(async () => {
  const router = process.argv[2];
  const password = process.argv[3];
  const action = process.argv[4] || 'core/Reboot';
  const user = process.argv[5] || 'admin';

  if (!password || !router || !action) {
    throw new Error(
      'Usage: node linksys_router_restart.js "<router_ip>" "<password>"'
    );
  }

  await callJNAPRouter({ router, password, action, user });
})();
