import { callJNAPRouter } from '../handlers/linksys_jnap_router';

(async () => {
  const router = process.argv[2];
  const password = process.argv[3];
  const user = process.argv[4] || 'admin';
  const data = JSON.parse(process.argv[5] || '{ "isSwitchportLEDEnabled": false }');
  const action = 'routerleds/SetRouterLEDSettings';

  if (!password || !router || !action) {
    throw new Error(
      'Usage: node linksys_jnap_router_led_off.js "<router_ip>" "<password>"'
    );
  }

  await callJNAPRouter({ router, password, action, user, data });
})();
