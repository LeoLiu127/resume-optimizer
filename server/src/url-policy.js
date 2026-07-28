import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice('::ffff:'.length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return (
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('ff') ||
    value.startsWith('2001:db8:')
  );
}

function isPrivateAddress(address) {
  const normalized = String(address || '').replace(/^\[|\]$/g, '');
  const family = isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family === 6) return isPrivateIpv6(normalized);
  return true;
}

function isLocalHostname(hostname) {
  const value = hostname.toLowerCase().replace(/\.$/, '');
  return (
    value === 'localhost' ||
    value.endsWith('.localhost') ||
    value.endsWith('.local') ||
    value.endsWith('.internal') ||
    value.endsWith('.home.arpa')
  );
}

export async function assertPublicHttpUrl(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch {
    throw new Error('请输入有效的公网 http/https 链接');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('请输入有效的公网 http/https 链接');
  }
  if (parsed.username || parsed.password) {
    throw new Error('链接不能包含账号或密码');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isLocalHostname(hostname) || (isIP(hostname) && isPrivateAddress(hostname))) {
    throw new Error('不允许访问本机、内网或非公网地址');
  }

  const lookup = options.lookup || dnsLookup;
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('链接域名无法解析为公网地址');
  }
  const results = Array.isArray(addresses) ? addresses : [addresses];
  if (!results.length || results.some((item) => isPrivateAddress(item?.address))) {
    throw new Error('不允许访问本机、内网或非公网地址');
  }

  return parsed.toString();
}
