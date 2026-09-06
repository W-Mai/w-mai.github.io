"use strict";

const MOD = 1000000007;

function parse(text, limit) {
  if (!/^[0-9]+$/.test(text ?? "")) throw new Error("expected an unsigned decimal integer");
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > limit) throw new Error("integer outside the supported range");
  return value;
}

function mix(n, seed) {
  let x = seed, acc = 0;
  for (let i = 0; i < n; ++i) {
    x = (25173 * x + 13849) % 65536;
    acc = (acc + x) % MOD;
  }
  return acc;
}

function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function sort(n, seed) {
  const values = new Array(n);
  let x = seed;
  for (let i = 0; i < n; ++i) {
    x = (25173 * x + 13849) % 65536;
    values[i] = x;
  }
  for (let i = 1; i < n; ++i) {
    const value = values[i];
    let j = i;
    while (j > 0 && values[j - 1] > value) {
      values[j] = values[j - 1];
      --j;
    }
    values[j] = value;
  }
  let checksum = 0;
  for (let i = 0; i < n; ++i) checksum = (checksum + (i + 1) * values[i]) % MOD;
  return checksum;
}

function batch(which, n, seed, repetitions) {
  let checksum = 0;
  for (let rep = 0; rep < repetitions; ++rep) {
    const s = (seed + rep * 17) % 65536;
    const value = which === "mix" ? mix(n, s)
      : which === "fib" ? fibonacci(n + s % 3) : sort(n, s);
    checksum = (checksum + value) % MOD;
  }
  return checksum;
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 4) throw new Error("usage: bench.js case n seed repetitions");
  const [which] = args;
  if (!["mix", "fib", "sort"].includes(which)) throw new Error("case must be mix, fib, or sort");
  const n = parse(args[1], 4294967295);
  const seed = parse(args[2], 65535);
  const repetitions = parse(args[3], 4294967295);
  if (repetitions === 0 || (which === "fib" && n > 40))
    throw new Error("repetitions must be positive; fib n must be at most 40");
  const warmups = parse(process.env.BENCH_WARMUP_BATCHES ?? "1", 1000);
  if (warmups === 0) throw new Error("BENCH_WARMUP_BATCHES must be positive");
  let warmupChecksum;
  for (let i = 0; i < warmups; ++i) warmupChecksum = batch(which, n, seed, repetitions);
  const start = process.hrtime.bigint();
  const checksum = batch(which, n, seed, repetitions);
  const elapsed_ns = Number(process.hrtime.bigint() - start);
  if (checksum !== warmupChecksum) throw new Error("warmup checksum differs");
  console.log(JSON.stringify({ engine: process.versions.bun ? "bun" : "node", case: which,
    n, seed, repetitions, checksum, elapsed_ns }));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
