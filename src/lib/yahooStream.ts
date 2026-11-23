// Minimal client for Yahoo Finance's (unofficial) real-time WebSocket streamer.
//
// wss://streamer.finance.yahoo.com/?version=2 pushes JSON frames of the form
//   {"type":"pricing","message":"<base64 protobuf PricingData>"}
// WebSockets are not subject to CORS, so this works straight from the browser
// with no API key and no proxy. Only the PricingData fields we use are decoded.

export interface PriceTick {
  id: string;            // symbol, e.g. "^GSPC"
  price: number;
  time: number;          // epoch ms
  changePercent?: number;
  change?: number;
  dayHigh?: number;
  dayLow?: number;
  openPrice?: number;
  previousClose?: number;
  dayVolume?: number;
  marketHours?: number;  // 0 pre, 1 regular, 2 post, 3 extended
}

const STREAM_URL = 'wss://streamer.finance.yahoo.com/?version=2';

// ── protobuf decoding ───────────────────────────────────────────────────────
// Fields we care about (field number → [name, kind]).
type Kind = 'string' | 'float' | 'sint64' | 'int';
const FIELDS: Record<number, [keyof PriceTick, Kind]> = {
  1: ['id', 'string'],
  2: ['price', 'float'],
  3: ['time', 'sint64'],
  7: ['marketHours', 'int'],
  8: ['changePercent', 'float'],
  9: ['dayVolume', 'sint64'],
  10: ['dayHigh', 'float'],
  11: ['dayLow', 'float'],
  12: ['change', 'float'],
  15: ['openPrice', 'float'],
  16: ['previousClose', 'float'],
};

export function decodePricingData(b64: string): PriceTick | null {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const view = new DataView(buf.buffer);
  let pos = 0;

  // Varints here can exceed 32 bits (ms timestamps), so accumulate as a
  // float64 Number — exact up to 2^53, which is plenty.
  const readVarint = (): number => {
    let result = 0;
    let mul = 1;
    for (;;) {
      if (pos >= buf.length) throw new Error('truncated varint');
      const b = buf[pos++];
      result += (b & 0x7f) * mul;
      if (!(b & 0x80)) return result;
      mul *= 128;
    }
  };
  const zigzag = (n: number) => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

  const out: Partial<PriceTick> = {};
  try {
    while (pos < buf.length) {
      const key = readVarint();
      const field = Math.floor(key / 8);
      const wire = key & 7;
      const spec = FIELDS[field];
      if (wire === 0) {
        const v = readVarint();
        if (spec) (out as Record<string, unknown>)[spec[0]] = spec[1] === 'sint64' ? zigzag(v) : v;
      } else if (wire === 5) {
        const v = view.getFloat32(pos, true);
        pos += 4;
        if (spec) (out as Record<string, unknown>)[spec[0]] = v;
      } else if (wire === 1) {
        pos += 8;
      } else if (wire === 2) {
        const len = readVarint();
        if (spec && spec[1] === 'string') {
          (out as Record<string, unknown>)[spec[0]] = new TextDecoder().decode(buf.subarray(pos, pos + len));
        }
        pos += len;
      } else {
        throw new Error(`unsupported wire type ${wire}`);
      }
    }
  } catch {
    return null;
  }
  if (!out.id || typeof out.price !== 'number') return null;
  return out as PriceTick;
}

// ── shared connection ───────────────────────────────────────────────────────
// One socket for the whole app; hooks subscribe to symbols and get callbacks.
// Reconnects with backoff, and re-sends subscriptions on every (re)connect.

type Listener = (tick: PriceTick) => void;
export type StreamStatus = 'connecting' | 'open' | 'closed';
type StatusListener = (s: StreamStatus) => void;

const listeners = new Map<string, Set<Listener>>();
const statusListeners = new Set<StatusListener>();
let ws: WebSocket | null = null;
let status: StreamStatus = 'closed';
let retryDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const setStatus = (s: StreamStatus) => {
  status = s;
  statusListeners.forEach(l => l(s));
};

const sendSubscribe = (symbols: string[]) => {
  if (ws?.readyState === WebSocket.OPEN && symbols.length) {
    ws.send(JSON.stringify({ subscribe: symbols }));
  }
};

function connect() {
  if (ws || typeof WebSocket === 'undefined') return;
  setStatus('connecting');
  const sock = new WebSocket(STREAM_URL);
  ws = sock;

  sock.onopen = () => {
    retryDelay = 1000;
    setStatus('open');
    sendSubscribe([...listeners.keys()]);
  };
  sock.onmessage = (e) => {
    let b64: string;
    try {
      const msg = JSON.parse(String(e.data));
      if (msg?.type !== 'pricing' || typeof msg.message !== 'string') return;
      b64 = msg.message;
    } catch {
      b64 = String(e.data); // version-1 style raw base64 frame
    }
    const tick = decodePricingData(b64);
    if (tick) listeners.get(tick.id)?.forEach(l => l(tick));
  };
  sock.onclose = () => {
    ws = null;
    setStatus('closed');
    if (listeners.size === 0) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  };
  sock.onerror = () => sock.close();
}

/** Subscribe to live ticks for a symbol. Returns an unsubscribe function. */
export function subscribeTicks(symbol: string, cb: Listener): () => void {
  let set = listeners.get(symbol);
  const isNew = !set;
  if (!set) { set = new Set(); listeners.set(symbol, set); }
  set.add(cb);
  if (!ws) connect();
  else if (isNew) sendSubscribe([symbol]);

  return () => {
    const s = listeners.get(symbol);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) {
      listeners.delete(symbol);
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ unsubscribe: [symbol] }));
    }
    if (listeners.size === 0) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      ws?.close();
    }
  };
}

export function onStreamStatus(cb: StatusListener): () => void {
  statusListeners.add(cb);
  cb(status);
  return () => { statusListeners.delete(cb); };
}
