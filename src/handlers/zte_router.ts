import axios from 'axios';

/**
 * ZTE Router Handler - Simplified Version
 * Uses manual cookie extraction to avoid ESM dependency issues.
 */
export async function callZTERouter({
  router = '',
  user = 'admin',
  password = '',
  action = 'test',
}: {
  router: string;
  user?: string;
  password: string;
  action: 'reboot' | 'test';
}) {
  if (!router || !password) {
    throw new Error('[ZTE] Missing parameters: router IP and password are required!');
  }

  const baseURL = `http://${router}`;
  let sessionCookie = '';

  try {
    console.log(`[ZTE] Starting operation: ${action} on ${router}`);

    // Step 1: Login
    const loginPayload = new URLSearchParams();
    loginPayload.append('Username', user);
    loginPayload.append('Password', password);
    loginPayload.append('action', 'login');

    const loginResponse = await axios.post('/', loginPayload.toString(), {
      baseURL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${baseURL}/`,
      },
      // Prevent axios from throwing on 302 redirects
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Extract cookie from 'set-cookie' header
    const setCookie = loginResponse.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      // Grab only the session part (usually 'ZTE_SID=...' or similar)
      sessionCookie = setCookie[0]?.split(';')[0] ?? sessionCookie;
    }

    if (loginResponse.data.includes('Login Error') || loginResponse.data.includes('ident.gch')) {
      throw new Error('Login failed: Invalid credentials.');
    }

    console.log('[ZTE] Successfully logged in.');

    // Step 2: Action Logic
    if (action === 'reboot') {
      console.log('[ZTE] Sending direct "Restart" command to LUA handler...');
      
      const rebootPayload = new URLSearchParams();
      // The 'Restart' command in this firmware usually targets the DEVINFO or DEV object
      rebootPayload.append('IF_ACTION', 'Restart'); 
      rebootPayload.append('_InstID', 'IGD');

      // Based on your previous working XML path:
      const handlerURL = `${baseURL}/common_page/ManagReg_lua.lua`;

      const response = await axios.post(handlerURL, rebootPayload.toString(), {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': sessionCookie,
          'Referer': `${baseURL}/getpage.lua?pid=123&nextpage=ManagDiag_StatusManag_t.lp`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      console.log('[ZTE] Handler Response:', response.data);

      if (response.data.includes('SUCC')) {
        console.log('[ZTE] Success! The router is rebooting...');
      } else {
        console.warn('[ZTE] Command sent, but response did not confirm success.');
      }
    } else if (action === 'test') {
      console.log('[ZTE] Running test: Verifying internal access...');
      
      const rootRes = await axios.get('/', {
        baseURL,
        headers: { 'Cookie': sessionCookie }
      });
      
      // 2. Check if we are still logged in
      // If the response contains "login" or "ident.gch", the cookie was ignored.
      // If it contains "Management", "Status", or "Logout", we are IN.
      const isLoggedIn = !rootRes.data.includes('ident.gch') && 
                         (rootRes.data.includes('main_t') || rootRes.data.includes('Logout'));

      if (rootRes.status === 200 && isLoggedIn) {
        console.log('[ZTE] TEST PASSED: Session accepted at root (/).');
      } else {
        console.log('[ZTE] Debug: Root response snippet:', rootRes.data.substring(0, 200));
        throw new Error('TEST FAILED: Session rejected or redirected to login.');
      }
    }

  } catch (error: any) {
    console.error(`[ZTE] Error during "${action}":`, error.message);
    throw error;
  }
}
