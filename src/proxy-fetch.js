import net from 'node:net';
import tls from 'node:tls';
import {execFileSync} from 'node:child_process';

function proxyUrlFromEnv(env = process.env, {fallbackGitConfig = true} = {}) {
  return env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy ?? (fallbackGitConfig ? proxyUrlFromGitConfig() : null);
}

function proxyUrlFromGitConfig() {
  try {
    return execFileSync('git', ['config', '--global', '--get', 'https.proxy'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim() || null;
  } catch {
    try {
      return execFileSync('git', ['config', '--global', '--get', 'http.proxy'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim() || null;
    } catch {
      return null;
    }
  }
}

function headersObject(headers = {}) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return {...headers};
}

function onceSocket(socket, event) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off(event, onEvent);
      socket.off('error', onError);
    };
    const onEvent = (...args) => {
      cleanup();
      resolve(args);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    socket.once(event, onEvent);
    socket.once('error', onError);
  });
}

function connectTcp({hostname, port}) {
  const socket = net.connect({host: hostname, port});
  return onceSocket(socket, 'connect').then(() => socket);
}

function readUntilHeaders(socket) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('end', onEnd);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error('Proxy connection closed before response headers.'));
    };
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      cleanup();
      resolve({
        headers: buffer.subarray(0, headerEnd).toString('latin1'),
        rest: buffer.subarray(headerEnd + 4),
      });
    };

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('end', onEnd);
  });
}

async function connectHttpTunnel(proxyUrl, targetUrl) {
  if (!['http:', 'https:'].includes(proxyUrl.protocol)) {
    throw new Error(`Unsupported proxy protocol: ${proxyUrl.protocol}`);
  }

  const proxyPort = Number(proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80));
  let socket = await connectTcp({hostname: proxyUrl.hostname, port: proxyPort});
  if (proxyUrl.protocol === 'https:') socket = tls.connect({socket, servername: proxyUrl.hostname});

  const auth = proxyUrl.username ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString('base64')}\r\n` : '';
  socket.write(`CONNECT ${targetUrl.hostname}:443 HTTP/1.1\r\nHost: ${targetUrl.hostname}:443\r\n${auth}Connection: keep-alive\r\n\r\n`);

  const {headers, rest} = await readUntilHeaders(socket);
  const statusLine = headers.split('\r\n')[0] ?? '';
  if (!/^HTTP\/\d(?:\.\d)? 2\d\d\b/.test(statusLine)) {
    socket.destroy();
    throw new Error(`Proxy CONNECT failed: ${statusLine}`);
  }

  return {socket, rest};
}

function readResponse(socket, initial = Buffer.alloc(0)) {
  return new Promise((resolve, reject) => {
    const chunks = initial.length ? [initial] : [];
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.once('error', reject);
    socket.once('end', () => resolve(Buffer.concat(chunks)));
  });
}

function parseHttpResponse(buffer) {
  const headerEnd = buffer.indexOf('\r\n\r\n');
  if (headerEnd === -1) throw new Error('Upstream response missing headers.');

  const headerText = buffer.subarray(0, headerEnd).toString('latin1');
  const body = buffer.subarray(headerEnd + 4);
  const [statusLine, ...headerLines] = headerText.split('\r\n');
  const [, statusText = ''] = /^HTTP\/\d(?:\.\d)?\s+(\d{3})\s*(.*)$/.exec(statusLine) ?? [];
  const headers = new Headers();
  for (const line of headerLines) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  return {status: Number(statusLine.split(/\s+/)[1]), statusText, headers, body};
}

async function fetchViaHttpProxy(url, options, proxyUrl) {
  const targetUrl = new URL(url);
  const {socket, rest} = await connectHttpTunnel(proxyUrl, targetUrl);
  const tlsSocket = tls.connect({socket, servername: targetUrl.hostname});
  if (rest.length) tlsSocket.unshift(rest);
  await onceSocket(tlsSocket, 'secureConnect');

  const headers = headersObject(options.headers);
  const method = options.method ?? 'GET';
  const body = options.body ? Buffer.from(options.body) : null;
  if (body && !headers['Content-Length'] && !headers['content-length']) headers['Content-Length'] = String(body.length);
  if (!headers.Host && !headers.host) headers.Host = targetUrl.host;
  if (!headers.Connection && !headers.connection) headers.Connection = 'close';

  const headerText = Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n');
  tlsSocket.write(`${method} ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\n${headerText}\r\n\r\n`);
  if (body) tlsSocket.write(body);
  tlsSocket.end();

  const responseBuffer = await readResponse(tlsSocket);
  const response = parseHttpResponse(responseBuffer);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function createFetchWithProxyFromEnv({fetchImpl = fetch, env = process.env, fallbackGitConfig = true} = {}) {
  const proxyValue = proxyUrlFromEnv(env, {fallbackGitConfig});
  if (!proxyValue) return fetchImpl;

  const proxyUrl = new URL(proxyValue);
  return async function fetchWithProxy(url, options = {}) {
    const targetUrl = new URL(url);
    if (targetUrl.protocol !== 'https:') return fetchImpl(url, options);
    return fetchViaHttpProxy(targetUrl, options, proxyUrl);
  };
}
