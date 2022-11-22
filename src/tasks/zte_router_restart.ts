import { callZTERouter } from '../handlers/zte_router';

(async () => {
  const router = process.argv[2];
  const user = process.argv[3];
  const password = process.argv[4];
  const action = 'Restart';

  if (!password || !router || !action) {
    throw new Error(
      'Usage: node zte_router_restart.js "<router_ip>" "<user>" "<password>"'
    );
  }

  await callZTERouter({ router, user, password, action });
})();
