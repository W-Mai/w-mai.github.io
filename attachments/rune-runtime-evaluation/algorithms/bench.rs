use std::{env, hint::black_box, process, time::Instant};

const MOD: u64 = 1_000_000_007;

fn parse(text: &str, limit: u64) -> Result<u64, &'static str> {
    if text.is_empty() || !text.bytes().all(|c| c.is_ascii_digit()) {
        return Err("expected an unsigned decimal integer");
    }
    let value: u64 = text.parse().map_err(|_| "integer out of range")?;
    if value > limit {
        return Err("integer outside the supported range");
    }
    Ok(value)
}

fn mix(n: u32, seed: u64) -> u64 {
    let (mut x, mut acc) = (seed, 0);
    for _ in 0..n {
        x = (25173 * x + 13849) % 65536;
        acc = (acc + x) % MOD;
    }
    acc
}

fn fibonacci(n: u32) -> u64 {
    if n < 2 {
        return n.into();
    }
    fibonacci(n - 1) + fibonacci(n - 2)
}

fn sort(n: u32, seed: u64) -> u64 {
    let mut values = Vec::<u32>::with_capacity(n as usize);
    let mut x = seed;
    for _ in 0..n {
        x = (25173 * x + 13849) % 65536;
        values.push(x as u32);
    }
    for i in 1..values.len() {
        let value = values[i];
        let mut j = i;
        while j > 0 && values[j - 1] > value {
            values[j] = values[j - 1];
            j -= 1;
        }
        values[j] = value;
    }
    let mut checksum = 0;
    for (i, value) in values.iter().enumerate() {
        checksum = (checksum + (i as u64 + 1) * u64::from(*value)) % MOD;
    }
    checksum
}

fn batch(which: &str, n: u32, seed: u64, reps: u32) -> u64 {
    let seed = black_box(seed);
    let mut checksum = 0;
    for rep in 0..reps {
        let s = (seed + u64::from(rep) * 17) % 65536;
        let value = match which {
            "mix" => mix(n, s),
            "fib" => fibonacci(n + (s % 3) as u32),
            _ => sort(n, s),
        };
        checksum = (checksum + value) % MOD;
    }
    checksum
}

fn run() -> Result<(), &'static str> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 5 {
        return Err("usage: bench-rust case n seed repetitions");
    }
    let which = args[1].as_str();
    if !matches!(which, "mix" | "fib" | "sort") {
        return Err("case must be mix, fib, or sort");
    }
    let n = parse(&args[2], u32::MAX.into())? as u32;
    let seed = parse(&args[3], 65535)?;
    let reps = parse(&args[4], u32::MAX.into())? as u32;
    if reps == 0 || (which == "fib" && n > 40) {
        return Err("repetitions must be positive; fib n must be at most 40");
    }
    let warmups = env::var("BENCH_WARMUP_BATCHES").unwrap_or_else(|_| "1".into());
    let warmups = parse(&warmups, 1000)?;
    if warmups == 0 {
        return Err("BENCH_WARMUP_BATCHES must be positive");
    }
    let mut warmup_checksum = 0;
    for _ in 0..warmups {
        warmup_checksum = black_box(batch(which, n, seed, reps));
    }
    let start = Instant::now();
    let checksum = batch(which, n, seed, reps);
    let elapsed = start.elapsed().as_nanos();
    if checksum != warmup_checksum {
        return Err("warmup checksum differs");
    }
    println!(
        "{{\"engine\":\"rust\",\"case\":\"{which}\",\"n\":{n},\"seed\":{seed},\"repetitions\":{reps},\"checksum\":{checksum},\"elapsed_ns\":{elapsed}}}"
    );
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(2);
    }
}
