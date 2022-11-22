import moxios from 'moxios';

export const sanitiseMoxios = (
  request: ReturnType<typeof moxios.requests.at>
) => ({
  baseUrl: request.config.baseURL,
  url: request.config.url,
  method: request.config.method,
  headers: { ...request.config.headers },
  data: request.config.data,
});
