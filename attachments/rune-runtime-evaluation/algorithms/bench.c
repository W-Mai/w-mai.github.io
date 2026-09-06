#define _POSIX_C_SOURCE 200809L
#include <ctype.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static const uint64_t MOD = 1000000007;
static volatile uint64_t warmup_sink;

static void fail(const char *message) {
    fprintf(stderr, "%s\n", message);
    exit(2);
}

static uint64_t parse(const char *text, uint64_t limit) {
    if (!*text) fail("expected an unsigned decimal integer");
    uint64_t value = 0;
    for (const unsigned char *p = (const unsigned char *)text; *p; ++p) {
        if (!isdigit(*p) || value > (limit - (*p - '0')) / 10)
            fail("integer outside the supported range");
        value = value * 10 + (*p - '0');
        if (value > limit) fail("integer outside the supported range");
    }
    return value;
}

static uint64_t mix(uint32_t n, uint64_t seed) {
    uint64_t x = seed, acc = 0;
    for (uint64_t i = 0; i < n; ++i) {
        x = (25173 * x + 13849) % 65536;
        acc = (acc + x) % MOD;
    }
    return acc;
}

static uint64_t fibonacci(uint32_t n) {
    if (n < 2) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

static uint64_t sort(uint32_t n, uint64_t seed) {
    if (n == 0) return 0;
    if ((uint64_t)n > SIZE_MAX / sizeof(uint32_t)) fail("array size overflow");
    uint32_t *values = malloc((size_t)n * sizeof(*values));
    if (!values) fail("array allocation failed");
    uint64_t x = seed;
    for (uint64_t i = 0; i < n; ++i) {
        x = (25173 * x + 13849) % 65536;
        values[i] = (uint32_t)x;
    }
    for (uint64_t i = 1; i < n; ++i) {
        uint32_t value = values[i];
        uint64_t j = i;
        while (j > 0 && values[j - 1] > value) {
            values[j] = values[j - 1];
            --j;
        }
        values[j] = value;
    }
    uint64_t checksum = 0;
    for (uint64_t i = 0; i < n; ++i)
        checksum = (checksum + (i + 1) * values[i]) % MOD;
    free(values);
    return checksum;
}

static uint64_t batch(const char *which, uint32_t n, uint64_t seed, uint32_t reps) {
    __asm__ __volatile__("" : "+r"(seed) : : "memory");
    uint64_t checksum = 0;
    for (uint64_t rep = 0; rep < reps; ++rep) {
        uint64_t s = (seed + rep * 17) % 65536;
        uint64_t value = strcmp(which, "mix") == 0 ? mix(n, s)
                       : strcmp(which, "fib") == 0 ? fibonacci(n + (uint32_t)(s % 3))
                       : sort(n, s);
        checksum = (checksum + value) % MOD;
    }
    return checksum;
}

int main(int argc, char **argv) {
    if (argc != 5) fail("usage: bench-c case n seed repetitions");
    const char *which = argv[1];
    if (strcmp(which, "mix") && strcmp(which, "fib") && strcmp(which, "sort"))
        fail("case must be mix, fib, or sort");
    uint32_t n = (uint32_t)parse(argv[2], UINT32_MAX);
    uint64_t seed = parse(argv[3], 65535);
    uint32_t reps = (uint32_t)parse(argv[4], UINT32_MAX);
    if (reps == 0 || (strcmp(which, "fib") == 0 && n > 40))
        fail("repetitions must be positive; fib n must be at most 40");
    const char *warmup = getenv("BENCH_WARMUP_BATCHES");
    uint64_t warmups = warmup ? parse(warmup, 1000) : 1;
    if (warmups == 0) fail("BENCH_WARMUP_BATCHES must be positive");
    for (uint64_t i = 0; i < warmups; ++i) warmup_sink = batch(which, n, seed, reps);
    struct timespec start, end;
    if (clock_gettime(CLOCK_MONOTONIC, &start)) fail("clock_gettime failed");
    uint64_t checksum = batch(which, n, seed, reps);
    if (clock_gettime(CLOCK_MONOTONIC, &end)) fail("clock_gettime failed");
    uint64_t elapsed = (uint64_t)((int64_t)(end.tv_sec - start.tv_sec) * 1000000000
                                 + end.tv_nsec - start.tv_nsec);
    if (checksum != warmup_sink) fail("warmup checksum differs");
    printf("{\"engine\":\"c\",\"case\":\"%s\",\"n\":%" PRIu32
           ",\"seed\":%" PRIu64 ",\"repetitions\":%" PRIu32
           ",\"checksum\":%" PRIu64 ",\"elapsed_ns\":%" PRIu64 "}\n",
           which, n, seed, reps, checksum, elapsed);
}
