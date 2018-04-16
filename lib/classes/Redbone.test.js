/*global test expect jest */
const { createApp, createKubik } = require('rubik-main/tests/helpers/creators');
const { Kubiks } = require('rubik-main');
const HTTP = require('rubik-http');
const Redbone = require('./Redbone');
const clientIO = require('socket.io-client');

jest.setTimeout(360000);

const startPort = 1993;

function initApp(port, autoStart = true) {
  const app = createApp();
  const config = createKubik(Kubiks.Config, app);
  config.configs.http = { port };
  config.configs.http.socket = { redbone: {} };
  createKubik(Kubiks.Log, app);
  const http = createKubik(HTTP, app);
  createKubik(HTTP.Socket, app);
  http.autoStart = autoStart;
  return app;
}

test('Add the Redbone\'s kubik and up app', async (done) => {
  const app = initApp(startPort + 1);
  const redbone = createKubik(Redbone, app);
  const socket = app.kubiks.get('http/socket');
  const config = app.kubiks.get('config');
  const http = app.kubiks.get('http');
  config.configs.http.socket.redbone.logTypes = true;
  config.configs.http.socket.redbone.dirTypes = true;
  const testAction = {
    type: '@@server/TEST',
    payload: 'testy text'
  }
  redbone.use(async (socket, action) => {
    try {
      expect(socket.rubik).toBe(app);
      if (action.type !== testAction.type) return;
      expect(action).toEqual(testAction);
      client.disconnect();
      await http.stop();
      done();
    } catch(err) {
      console.error(err);
      // skip for timeout
    }
  });
  await app.up();
  expect(app.kubiks.get('http/socket/redbone')).toBe(redbone);
  const client = clientIO('http://localhost:' + (startPort + 1));
  socket.on('connection', () => {
    client.emit('dispatch', testAction);
  });
});


test('Use watchers', async (done) => {
  const app = initApp(startPort);
  const redbone = createKubik(Redbone, app);
  const http = app.kubiks.get('http');
  const testAction = {
    type: '@@server/TEST',
    payload: 'testy text'
  }
  redbone.use({
    watchers: [{
      type: testAction.type,
      action: async (socket, action) => {
        try {
          expect(socket.rubik).toBe(app);
          expect(action).toEqual(testAction);
          client.disconnect();
          await http.stop();
          done();
        } catch(err) {
          console.error(err);
          // skip for timeout
        }
      }
    }]
  })
  await app.up();
  expect(app.kubiks.get('http/socket/redbone')).toBe(redbone);
  const client = clientIO('http://localhost:' + startPort);
  redbone.io.on('connection', () => {
    client.emit('dispatch', testAction);
  });
});
