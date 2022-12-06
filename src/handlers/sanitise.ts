import moxios from 'moxios';

type Req = ReturnType<typeof moxios.requests.at>;

interface Ret {
  baseUrl?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string | string[]>;
  data: any;
}

export const sanitiseMoxios = (
  request: Req
): Ret => ({
  baseUrl: request.config.baseURL,
  url: request.config.url,
  method: request.config.method,
  headers: { ...request.config.headers } as Record<string, string | string[]>,
  data: request.config.data,
});
