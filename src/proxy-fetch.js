import {execFileSync} from 'node:child_process';
import {fetch as undiciFetch, ProxyAgent} from 'undici';

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

function requestTimeoutMs(env = process.env) {
  const value = Number(env.OPEN_BOUNTY_RADAR_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

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

export function createFetchWithProxyFromEnv({fetchImpl = fetch, env = process.env, fallbackGitConfig = true} = {}) {
  const proxyValue = proxyUrlFromEnv(env, {fallbackGitConfig});
  if (!proxyValue) return fetchImpl;

  const proxyUrl = new URL(proxyValue);
  const dispatcher = new ProxyAgent(proxyUrl.toString());
  const timeoutMs = requestTimeoutMs(env);
  return async function fetchWithProxy(url, options = {}) {
    const targetUrl = new URL(url);
    if (targetUrl.protocol !== 'https:') return fetchImpl(url, options);
    return undiciFetch(targetUrl, {
      ...options,
      dispatcher,
      signal: options.signal ?? AbortSignal.timeout(timeoutMs),
    });
  };
}
