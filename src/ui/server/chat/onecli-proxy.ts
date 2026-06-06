/**
 * OneCLI proxy for outbound OpenRouter requests from the host process.
 *
 * The OneCLI gateway is an HTTPS CONNECT proxy that injects API credentials
 * (e.g. the OpenRouter API key) into requests passing through it. Containers
 * get the proxy wired automatically via env vars; the host uses this module
 * to route specific requests through the same gateway.
 *
 * The proxy config (URL + CA cert) is fetched once from the OneCLI control
 * plane and cached for the process lifetime.
 */
import http from 'http';
import https from 'https';
import tls from 'tls';
import fs from 'fs';
import { URL } from 'url';

import { OneCLI } from '@onecli-sh/sdk';

import { ONECLI_API_KEY, ONECLI_URL } from '../../../config.js';
import { log } from '../../../log.js';

interface ProxyConfig {
  proxyUrl: URL;
  caCert: string;
}

let cachedConfig: ProxyConfig | null = null;
let configPromise: Promise<ProxyConfig | null> | null = null;

async function resolveProxyConfig(): Promise<ProxyConfig | null> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    if (!ONECLI_URL || !ONECLI_API_KEY) {
      log.debug('OneCLI not configured — proxy unavailable');
      return null;
    }
    try {
      const onecli = new OneCLI({ url: ONECLI_URL, apiKey: ONECLI_API_KEY });
      const config = await onecli.getContainerConfig();
      const rawProxy = config.env.HTTPS_PROXY || config.env.https_proxy;
      if (!rawProxy) {
        log.warn('OneCLI config has no HTTPS_PROXY');
        return null;
      }
      // Replace host.docker.internal with the actual OneCLI host (for host-side use)
      const onecliHost = new URL(ONECLI_URL).hostname;
      const hostProxy = rawProxy.replace('host.docker.internal', onecliHost);

      cachedConfig = { proxyUrl: new URL(hostProxy), caCert: config.caCertificate };
      log.info('OneCLI proxy configured', { proxy: `${cachedConfig.proxyUrl.hostname}:${cachedConfig.proxyUrl.port}` });
      return cachedConfig;
    } catch (err) {
      log.warn('Failed to resolve OneCLI proxy config', { err: String(err) });
      return null;
    } finally {
      configPromise = null;
    }
  })();
  return configPromise;
}

/**
 * Fetch a URL through the OneCLI CONNECT proxy.
 * Falls back to a direct fetch (with explicit API key) if the proxy is unavailable.
 */
export async function proxyFetch(url: string, init: RequestInit & { timeout?: number }): Promise<Response> {
  const config = await resolveProxyConfig();
  if (!config) {
    // Fallback: direct fetch (caller must handle auth separately)
    return fetch(url, init);
  }
  return tunnelFetch(url, init, config);
}

/**
 * Returns true if the OneCLI proxy is available (configured and reachable).
 */
export async function isProxyAvailable(): Promise<boolean> {
  const config = await resolveProxyConfig();
  return config !== null;
}

function tunnelFetch(
  targetUrl: string,
  init: RequestInit & { timeout?: number },
  config: ProxyConfig,
): Promise<Response> {
  const target = new URL(targetUrl);
  const { proxyUrl, caCert } = config;
  const timeoutMs = init.timeout ?? 30_000;

  return new Promise((resolve, reject) => {
    const connectReq = http.request({
      hostname: proxyUrl.hostname,
      port: parseInt(proxyUrl.port, 10),
      method: 'CONNECT',
      path: `${target.hostname}:${target.port || 443}`,
      headers: {
        'Proxy-Authorization':
          'Basic ' +
          Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString(
            'base64',
          ),
        Host: `${target.hostname}:${target.port || 443}`,
      },
      timeout: timeoutMs,
    });

    connectReq.on('connect', (_res, socket) => {
      // Upgrade to TLS over the tunnel
      const tlsSocket = tls.connect(
        {
          socket,
          servername: target.hostname,
          ca: caCert,
        },
        () => {
          // Now make the HTTPS request through the TLS tunnel
          const reqOptions: https.RequestOptions = {
            hostname: target.hostname,
            port: target.port || 443,
            path: target.pathname + target.search,
            method: init.method || 'GET',
            headers: {
              ...((init.headers as Record<string, string>) || {}),
              Host: target.hostname,
            },
            createConnection: () => tlsSocket,
            timeout: timeoutMs,
          };

          const httpsReq = https.request(reqOptions, (res) => {
            // Convert Node IncomingMessage to a Web Response
            const headers = new Headers();
            for (const [key, val] of Object.entries(res.headers)) {
              if (val) headers.set(key, Array.isArray(val) ? val.join(', ') : val);
            }

            // Create a ReadableStream from the response
            const readable = new ReadableStream({
              start(controller) {
                res.on('data', (chunk: Buffer) => controller.enqueue(chunk));
                res.on('end', () => controller.close());
                res.on('error', (err) => controller.error(err));
              },
            });

            resolve(
              new Response(readable, {
                status: res.statusCode || 500,
                statusText: res.statusMessage || '',
                headers,
              }),
            );
          });

          httpsReq.on('error', (err) => reject(err));
          httpsReq.on('timeout', () => {
            httpsReq.destroy();
            reject(new Error('request_timeout'));
          });

          if (init.body) {
            httpsReq.write(typeof init.body === 'string' ? init.body : init.body);
          }
          httpsReq.end();
        },
      );

      tlsSocket.on('error', (err) => reject(err));
    });

    connectReq.on('error', (err) => reject(err));
    connectReq.on('timeout', () => {
      connectReq.destroy();
      reject(new Error('connect_timeout'));
    });
    connectReq.end();
  });
}
