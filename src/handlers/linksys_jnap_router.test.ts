import moxios from 'moxios';
import { callJNAPRouter } from './linksys_jnap_router';
import { sanitiseMoxios } from './sanitise';

describe('callJNAPRouter', () => {
  beforeEach(() => {
    moxios.install();
  });

  afterEach(() => {
    moxios.uninstall();
  });

  it('calls axios', async () => {
    const router = 'example-router';
    moxios.stubOnce('POST', `/JNAP/`, {
      status: 200,
      response: { result: 'OK' },
    });

    await callJNAPRouter({
      router,
      user: 'example-user',
      password: 'example-password',
      action: 'example-password',
      data: { example: 'data' },
    });

    expect(moxios.requests.count()).toEqual(1);
    expect(sanitiseMoxios(moxios.requests.at(0))).toMatchSnapshot();
  });
});
