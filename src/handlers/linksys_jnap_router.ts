import axios from 'axios';

export async function callJNAPRouter({
  router = '',
  user = '',
  password = '',
  action = '',
  data = {},
}) {
  const baseURL = `http://${router}/`;
  const response = await axios.request({
    baseURL,
    url: '/JNAP/',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-JNAP-Authorization': `Basic ${Buffer.from(
        `${user}:${password}`,
        'utf-8'
      ).toString('base64')}`,
      'X-JNAP-Action': `http://linksys.com/jnap/${action}`,
    },
    data,
  });

  if (response.data.result !== 'OK') {
    throw Object.assign(new Error(response.data.result), response.data);
  }

  return response.data;
}
