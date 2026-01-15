/**
 * SAFEGUARD: Make it IMPOSSIBLE to fetch external URLs from local machine
 *
 * This patches fetch to block all external requests unless running on the VPS.
 * If you try to fetch from local, you get a giant error and it throws.
 */

const ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
]);

let safeguardEnabled = false;

function isExternalHost(hostname: string): boolean {
  return !ALLOWED_HOSTS.has(hostname);
}

function blockError(host: string): Error {
  const msg = `
╔══════════════════════════════════════════════════════════════════╗
║  🚫 LOCAL FETCH BLOCKED - THIS IS NOT ALLOWED                   ║
╠══════════════════════════════════════════════════════════════════╣
║  You tried to fetch: ${host.slice(0, 40).padEnd(40)}  ║
║                                                                  ║
║  All URL fetching MUST happen on the VPS, not your laptop.      ║
║  Your IP will get banned if you fetch from local machine.       ║
║                                                                  ║
║  Run this instead:                                               ║
║  ssh llmfetch "cd /opt/llmfetch && node dist/index.js '<url>'"  ║
╚══════════════════════════════════════════════════════════════════╝
`;
  console.error(msg);
  return new Error(`BLOCKED: Cannot fetch ${host} from local machine`);
}

export function enableSafeguard() {
  if (safeguardEnabled) return;
  safeguardEnabled = true;

  // Patch global fetch - this is the main way requests are made
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else if (input && typeof input === 'object' && 'url' in input) {
      url = (input as Request).url;
    } else {
      url = String(input);
    }

    try {
      const parsed = new URL(url);
      if (isExternalHost(parsed.hostname)) {
        throw blockError(parsed.hostname);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('BLOCKED:')) {
        throw e;
      }
      // URL parsing failed - might be relative, let it through
    }

    return originalFetch(input, init);
  };

  console.error('');
  console.error('🛡️  SAFEGUARD ACTIVE: External fetches BLOCKED on local machine');
  console.error('   To fetch URLs, run on VPS: ssh llmfetch "cd /opt/llmfetch && ..."');
  console.error('');
}

export function isRunningOnVPS(): boolean {
  // Multiple ways to detect if we're on the VPS
  const hostname = process.env.HOSTNAME || '';
  const user = process.env.USER || '';
  const pwd = process.cwd();

  // On VPS if any of these are true:
  return (
    hostname.includes('llmfetch') ||
    hostname.includes('ubuntu-8gb') ||
    process.env.VPS === '1' ||
    process.env.LLMFETCH_VPS === '1' ||
    pwd.startsWith('/opt/llmfetch') ||
    user === 'root'  // VPS runs as root
  );
}

export function requireVPS() {
  if (!isRunningOnVPS()) {
    enableSafeguard();
  }
}
