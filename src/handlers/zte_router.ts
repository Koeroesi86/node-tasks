import axios, { RawAxiosResponseHeaders } from 'axios';

const encode = (obj: Record<string, string>) =>
  Object.entries(obj)
    .map(([k, v]) => encodeURI(k) + '=' + encodeURI(v))
    .join('&');

const parseSID = (setIDCookie: string) =>
  setIDCookie.replace('SID=', '').replace('; PATH=/; HttpOnly', '');

const getSID = (headers: RawAxiosResponseHeaders) =>
  Array.isArray(headers['set-cookie'])
    ? parseSID(headers['set-cookie'].find((c) => c.startsWith('SID=')) || '')
    : parseSID(headers['set-cookie'] ?? '');

export async function callZTERouter({
  router = '',
  user = '',
  password = '',
  action = '',
}) {
  const baseURL = `http://${router}/`;
  const defaultHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Cookie: '_TESTCOOKIESUPPORT=1',
    Host: router,
    Referer: baseURL,
  };

  const loginResponse = await axios.request({
    baseURL,
    url: '/',
    method: 'POST',
    headers: defaultHeaders,
    data: encode({
      action: 'login',
      Username: user,
      Password: password,
    }),
  });
  const sid = getSID(loginResponse.headers);

  if (!sid) {
    throw Object.assign(new Error('SID not received.'), {
      statusCode: loginResponse.status,
      headers: loginResponse.headers,
    });
  }

  const response = await axios.request({
    baseURL,
    url: '/',
    method: 'POST',
    headers: {
      ...defaultHeaders,
      Cookie: `${defaultHeaders['Cookie']}; SID=${sid}`,
    },
    data: encode({
      action,
    }),
  });

  return response.data;
}
