#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string_view>
#include <vector>

constexpr std::uint64_t MOD = 1000000007;
static volatile std::uint64_t warmup_sink;

static std::uint64_t parse(std::string_view text, std::uint64_t limit) {
    if (text.empty()) throw std::runtime_error("expected an unsigned decimal integer");
    std::uint64_t value = 0;
    for (char c : text) {
        if (c < '0' || c > '9' || value > (limit - (c - '0')) / 10)
            throw std::runtime_error("integer outside the supported range");
        value = value * 10 + (c - '0');
        if (value > limit) throw std::runtime_error("integer outside the supported range");
    }
    return value;
}

static std::uint64_t mix(std::uint32_t n, std::uint64_t seed) {
    std::uint64_t x = seed, acc = 0;
    for (std::uint64_t i = 0; i < n; ++i) {
        x = (25173 * x + 13849) % 65536;
        acc = (acc + x) % MOD;
    }
    return acc;
}

static std::uint64_t fibonacci(std::uint32_t n) {
    if (n < 2) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

static std::uint64_t sort(std::uint32_t n, std::uint64_t seed) {
    std::vector<std::uint32_t> values;
    values.reserve(n);
    std::uint64_t x = seed;
    for (std::uint64_t i = 0; i < n; ++i) {
        x = (25173 * x + 13849) % 65536;
        values.push_back(static_cast<std::uint32_t>(x));
    }
    for (std::uint64_t i = 1; i < n; ++i) {
        auto value = values[i];
        std::uint64_t j = i;
        while (j > 0 && values[j - 1] > value) {
            values[j] = values[j - 1];
            --j;
        }
        values[j] = value;
    }
    std::uint64_t checksum = 0;
    for (std::uint64_t i = 0; i < n; ++i)
        checksum = (checksum + (i + 1) * values[i]) % MOD;
    return checksum;
}

static std::uint64_t batch(std::string_view which, std::uint32_t n,
                           std::uint64_t seed, std::uint32_t reps) {
    __asm__ __volatile__("" : "+r"(seed) : : "memory");
    std::uint64_t checksum = 0;
    for (std::uint64_t rep = 0; rep < reps; ++rep) {
        auto s = (seed + rep * 17) % 65536;
        auto value = which == "mix" ? mix(n, s)
                   : which == "fib" ? fibonacci(n + static_cast<std::uint32_t>(s % 3))
                   : sort(n, s);
        checksum = (checksum + value) % MOD;
    }
    return checksum;
}

int main(int argc, char **argv) {
    try {
        if (argc != 5) throw std::runtime_error("usage: bench-cpp case n seed repetitions");
        std::string_view which = argv[1];
        if (which != "mix" && which != "fib" && which != "sort")
            throw std::runtime_error("case must be mix, fib, or sort");
        auto n = static_cast<std::uint32_t>(parse(argv[2], UINT32_MAX));
        auto seed = parse(argv[3], 65535);
        auto reps = static_cast<std::uint32_t>(parse(argv[4], UINT32_MAX));
        if (reps == 0 || (which == "fib" && n > 40))
            throw std::runtime_error("repetitions must be positive; fib n must be at most 40");
        auto warmup = std::getenv("BENCH_WARMUP_BATCHES");
        auto warmups = warmup ? parse(warmup, 1000) : 1;
        if (warmups == 0) throw std::runtime_error("BENCH_WARMUP_BATCHES must be positive");
        for (std::uint64_t i = 0; i < warmups; ++i) warmup_sink = batch(which, n, seed, reps);
        auto start = std::chrono::steady_clock::now();
        auto checksum = batch(which, n, seed, reps);
        auto end = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
        if (checksum != warmup_sink) throw std::runtime_error("warmup checksum differs");
        std::cout << "{\"engine\":\"cpp\",\"case\":\"" << which << "\",\"n\":" << n
                  << ",\"seed\":" << seed << ",\"repetitions\":" << reps
                  << ",\"checksum\":" << checksum << ",\"elapsed_ns\":" << elapsed << "}\n";
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n';
        return 2;
    }
}
