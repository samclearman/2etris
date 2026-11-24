// Eight lowercase letters/digits keep existing invite links and manual entry compatible.
export function shortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  while (id.length < 8) {
    for (const byte of crypto.getRandomValues(new Uint8Array(12))) {
      if (byte >= 252) continue; // discard the partial range rather than biasing the code
      id += chars[byte % chars.length];
      if (id.length === 8) return id;
    }
  }
  return id;
}
