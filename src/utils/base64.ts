// React Native has no global btoa/atob. These are plain-JS re-implementations
// of the standard browser algorithms (not a crypto library) so that:
//   1. passwordHash = btoa(password + salt) produces the SAME string here as
//      it does in the PWA — a backup restored from the web app must let the
//      teacher log in with their existing password.
//   2. the ECR template blob round-trips (ArrayBuffer <-> base64) exactly
//      like base64ToArrayBuffer/arrayBufferToBase64 do in the PWA.

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function btoa(input: string): string {
  let output = '';
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++) & 0xff;
    const haveC2 = i < input.length;
    const c2 = haveC2 ? input.charCodeAt(i++) & 0xff : 0;
    const haveC3 = i < input.length;
    const c3 = haveC3 ? input.charCodeAt(i++) & 0xff : 0;

    const e1 = c1 >> 2;
    const e2 = ((c1 & 0x3) << 4) | (c2 >> 4);
    const e3 = ((c2 & 0xf) << 2) | (c3 >> 6);
    const e4 = c3 & 0x3f;

    output +=
      CHARS.charAt(e1) +
      CHARS.charAt(e2) +
      (haveC2 ? CHARS.charAt(e3) : '=') +
      (haveC3 ? CHARS.charAt(e4) : '=');
  }
  return output;
}

export function atob(input: string): string {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';
  let i = 0;
  while (i < clean.length) {
    const e1 = CHARS.indexOf(clean.charAt(i++));
    const e2 = CHARS.indexOf(clean.charAt(i++));
    const e3 = CHARS.indexOf(clean.charAt(i++));
    const e4 = CHARS.indexOf(clean.charAt(i++));

    const c1 = (e1 << 2) | (e2 >> 4);
    const c2 = ((e2 & 0xf) << 4) | (e3 >> 2);
    const c3 = ((e3 & 0x3) << 6) | (e4 & 0x3f);

    output += String.fromCharCode(c1);
    if (e3 !== 64 && e3 !== -1) output += String.fromCharCode(c2);
    if (e4 !== 64 && e4 !== -1) output += String.fromCharCode(c3);
  }
  return output;
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
