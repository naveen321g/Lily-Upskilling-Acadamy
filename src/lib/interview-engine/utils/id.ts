/** Lightweight unique-id generator for message/question ids within one interview. */
let counter = 0;

export function uid(prefix = ""): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const seq = counter.toString(36);
  return `${prefix}${prefix ? "_" : ""}${time}${rand}${seq}`;
}
