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
    const router = 'example-router';

    moxios.stubRequest('/index.gch', {
      status: 200,
      headers: { 'set-cookie': ['SID=example-token; PATH=/; HttpOnly'] },
      response: 'Login successful',
    });
    moxios.stubRequest(/\/getpage.gch\?.*/, {
      status: 200,
      headers: { 'set-cookie': ['SID=example-token; PATH=/; HttpOnly'] },
      response: 'Login successful',
    });

    await callZTERouter({
      router,
      user: 'example-user',
      password: 'example-password',
      action: 'test',
    });

    expect(moxios.requests.count()).toEqual(2);
    expect(sanitiseMoxios(moxios.requests.get('post', '/index.gch'))).toMatchSnapshot();
    expect(sanitiseMoxios(moxios.requests.get('get', '/getpage.gch?pid=1002&nextpage=status_dev_info_t.gch'))).toMatchSnapshot();
  });
});
