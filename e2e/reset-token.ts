import tls from "node:tls";

/**
 * Reads the password reset token the backend just wrote to Redis.
 *
 * Locally and in this suite there is no SMTP, so the mailed link is not something the browser
 * can follow; the token is only ever written to the store, and reading it is what the shopper's
 * inbox would otherwise do. Redis is reached with the same REDIS_URL the Spring app boots with
 * (scripts/e2e.mjs puts the backend .env into this process), and RESP is spoken directly rather
 * than adding a client dependency to a test-only helper.
 */

type Reply = string | number | null | Reply[];

class Reader {
  private buffer = Buffer.alloc(0);
  private pending: { resolve: (v: Reply) => void; reject: (e: Error) => void }[] = [];

  constructor(private readonly socket: tls.TLSSocket) {
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
  }

  /** A frame is only consumed once the whole reply is buffered, so partial reads cannot desync. */
  private parse(offset: number): { value: Reply; next: number } | { error: string; next: number } | null {
    const type = String.fromCharCode(this.buffer[offset]);
    const end = this.buffer.indexOf("\r\n", offset);
    if (end === -1) return null;
    const head = this.buffer.subarray(offset + 1, end).toString();
    const after = end + 2;

    if (type === "+" || type === ":") return { value: type === ":" ? Number(head) : head, next: after };
    if (type === "-") return { error: head, next: after };
    if (type === "$") {
      const length = Number(head);
      if (length === -1) return { value: null, next: after };
      if (this.buffer.length < after + length + 2) return null;
      return { value: this.buffer.subarray(after, after + length).toString(), next: after + length + 2 };
    }
    if (type === "*") {
      const count = Number(head);
      const items: Reply[] = [];
      let cursor = after;
      for (let i = 0; i < count; i++) {
        const item = this.parse(cursor);
        if (!item) return null;
        if ("error" in item) return item;
        items.push(item.value);
        cursor = item.next;
      }
      return { value: items, next: cursor };
    }
    return { error: `unhandled RESP type ${type}`, next: this.buffer.length };
  }

  private drain() {
    while (this.pending.length) {
      const reply = this.parse(0);
      if (!reply) return;
      this.buffer = this.buffer.subarray(reply.next);
      const waiter = this.pending.shift()!;
      if ("error" in reply) waiter.reject(new Error(reply.error));
      else waiter.resolve(reply.value);
    }
  }

  command(...args: (string | number)[]): Promise<Reply> {
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      const frame: (string | Buffer)[] = [`*${args.length}`];
      for (const arg of args) {
        const bytes = Buffer.from(String(arg));
        frame.push(`$${bytes.length}`, bytes);
      }
      this.socket.write(frame.join("\r\n") + "\r\n");
    });
  }
}

function connect(url: URL) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const socket = tls.connect(
      { host: url.hostname, port: Number(url.port || 6379), servername: url.hostname },
      () => resolve(socket),
    );
    socket.on("error", reject);
  });
}

/** The token handed to a reset link for this user id, or null when none is outstanding. */
export async function readResetToken(userId: number): Promise<string | null> {
  const raw = process.env.REDIS_URL;
  if (!raw) return null;
  const url = new URL(raw);
  const socket = await connect(url);
  const reader = new Reader(socket);
  try {
    if (url.password) await reader.command("AUTH", decodeURIComponent(url.username) || "default", decodeURIComponent(url.password));
    const keys = (await reader.command("KEYS", "pwreset::*")) as string[];
    for (const key of keys) {
      if ((await reader.command("GET", key)) === String(userId)) return key.slice("pwreset::".length);
    }
    return null;
  } finally {
    socket.end();
  }
}

/** True once the token has been spent — the store deletes it on the first use. */
export async function resetTokenExists(token: string): Promise<boolean> {
  const raw = process.env.REDIS_URL;
  if (!raw) return false;
  const url = new URL(raw);
  const socket = await connect(url);
  const reader = new Reader(socket);
  try {
    if (url.password) await reader.command("AUTH", decodeURIComponent(url.username) || "default", decodeURIComponent(url.password));
    return (await reader.command("EXISTS", `pwreset::${token}`)) === 1;
  } finally {
    socket.end();
  }
}
