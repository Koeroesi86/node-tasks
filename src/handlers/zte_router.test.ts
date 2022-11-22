import moxios from 'moxios';
import { callZTERouter } from './zte_router';
import { sanitiseMoxios } from './sanitise';

describe('callZTERouter', () => {
  beforeEach(() => {
    moxios.install();
  });

  afterEach(() => {
    moxios.uninstall();
  });

  it('calls axios', async () => {
    moxios.stubRequest('/', {
      status: 200,
      headers: { 'set-cookie': ['SID=example-token; PATH=/; HttpOnly'] },
      response: {},
    });

    await callZTERouter({
      router: 'example-router',
      user: 'example-user',
      password: 'example-password',
      action: 'exampel-action',
    });

    expect(moxios.requests.count()).toEqual(2);
    expect(sanitiseMoxios(moxios.requests.at(0))).toMatchSnapshot();
    expect(sanitiseMoxios(moxios.requests.at(1))).toMatchSnapshot();
  });
});
