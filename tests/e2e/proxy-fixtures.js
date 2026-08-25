import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function close(server) {
  if (!server.listening) {
    return;
  }
  server.close();
  await once(server, 'close');
}

function parseSocksRequest(buffer) {
  if (buffer.length < 4 || buffer[0] !== 5 || buffer[1] !== 1) {
    return null;
  }
  const addressType = buffer[3];
  let offset = 4;
  let host;

  if (addressType === 1) {
    if (buffer.length < offset + 4 + 2) {
      return null;
    }
    host = [...buffer.subarray(offset, offset + 4)].join('.');
    offset += 4;
  }
  else if (addressType === 3) {
    if (buffer.length < offset + 1) {
      return null;
    }
    const length = buffer[offset];
    offset += 1;
    if (buffer.length < offset + length + 2) {
      return null;
    }
    host = buffer.subarray(offset, offset + length).toString('utf8');
    offset += length;
  }
  else if (addressType === 4) {
    if (buffer.length < offset + 16 + 2) {
      return null;
    }
    const groups = [];
    for (let index = 0; index < 16; index += 2) {
      groups.push(buffer.readUInt16BE(offset + index).toString(16));
    }
    host = groups.join(':');
    offset += 16;
  }
  else {
    throw new Error('Unsupported SOCKS address type: ' + addressType);
  }

  return {
    host,
    port: buffer.readUInt16BE(offset),
    consumed: offset + 2
  };
}

function createSocksServer(metrics) {
  return net.createServer(client => {
    let stage = 'greeting';
    let pending = Buffer.alloc(0);

    const fail = () => client.destroy();
    const onData = chunk => {
      pending = Buffer.concat([pending, chunk]);

      if (stage === 'greeting') {
        if (pending.length < 2) {
          return;
        }
        const methodsLength = pending[1];
        if (pending.length < 2 + methodsLength || pending[0] !== 5) {
          return;
        }
        pending = pending.subarray(2 + methodsLength);
        client.write(Buffer.from([5, 0]));
        stage = 'request';
      }

      if (stage !== 'request') {
        return;
      }

      let request;
      try {
        request = parseSocksRequest(pending);
      }
      catch {
        fail();
        return;
      }
      if (!request) {
        return;
      }

      pending = pending.subarray(request.consumed);
      stage = 'connected';
      metrics.socksConnections += 1;
      const destinationHost = request.host === 'target.test'
        ? '127.0.0.1'
        : request.host;
      const upstream = net.connect(request.port, destinationHost);

      upstream.once('connect', () => {
        client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
        if (pending.length) {
          upstream.write(pending);
        }
        client.removeListener('data', onData);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.once('error', fail);
      client.once('error', () => upstream.destroy());
    };

    client.on('data', onData);
  });
}

export async function createProxyFixtures() {
  const metrics = {
    directHits: 0,
    httpProxyHits: 0,
    socksConnections: 0
  };
  const target = http.createServer((_request, response) => {
    metrics.directHits += 1;
    response.writeHead(200, {'content-type': 'text/plain'});
    response.end('DIRECT_TARGET_OK');
  });
  const httpProxy = http.createServer((_request, response) => {
    metrics.httpProxyHits += 1;
    response.writeHead(200, {'content-type': 'text/plain'});
    response.end('HTTP_PROXY_OK');
  });
  const socksProxy = createSocksServer(metrics);
  const sockets = new Set();
  for (const server of [target, httpProxy, socksProxy]) {
    server.on('connection', socket => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
  }

  const [targetPort, httpProxyPort, socksProxyPort] = await Promise.all([
    listen(target),
    listen(httpProxy),
    listen(socksProxy)
  ]);

  return {
    metrics,
    targetPort,
    httpProxyPort,
    socksProxyPort,
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }
      await Promise.all([
        close(target),
        close(httpProxy),
        close(socksProxy)
      ]);
    }
  };
}
