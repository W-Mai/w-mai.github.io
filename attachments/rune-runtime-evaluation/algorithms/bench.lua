local engine = jit and "luajit" or "lua"
local base = (arg[0]:match("^(.*)/") or ".")
package.cpath = base .. "/build/" .. engine .. "/?.so;" .. package.cpath
local clock = require("benchclock")
local MOD = 1000000007

local function parse(text, limit)
    if not text or not text:match("^%d+$") then error("expected an unsigned decimal integer") end
    local value = tonumber(text)
    if not value or value > limit or value ~= math.floor(value) then
        error("integer outside the supported range")
    end
    return value
end

local function mix(n, seed)
    local x, acc = seed, 0
    for _ = 1, n do
        x = (25173 * x + 13849) % 65536
        acc = (acc + x) % MOD
    end
    return acc
end

local function fibonacci(n)
    if n < 2 then return n end
    return fibonacci(n - 1) + fibonacci(n - 2)
end

local function sort(n, seed)
    local values = {}
    local x = seed
    for i = 1, n do
        x = (25173 * x + 13849) % 65536
        values[i] = x
    end
    for i = 2, n do
        local value = values[i]
        local j = i
        while j > 1 and values[j - 1] > value do
            values[j] = values[j - 1]
            j = j - 1
        end
        values[j] = value
    end
    local checksum = 0
    for i = 1, n do checksum = (checksum + i * values[i]) % MOD end
    return checksum
end

local function batch(which, n, seed, repetitions)
    local checksum = 0
    for rep = 0, repetitions - 1 do
        local s = (seed + rep * 17) % 65536
        local value
        if which == "mix" then value = mix(n, s)
        elseif which == "fib" then value = fibonacci(n + s % 3)
        else value = sort(n, s) end
        checksum = (checksum + value) % MOD
    end
    return checksum
end

if #arg ~= 4 then error("usage: bench.lua case n seed repetitions") end
local which = arg[1]
if which ~= "mix" and which ~= "fib" and which ~= "sort" then error("case must be mix, fib, or sort") end
local n = parse(arg[2], 4294967295)
local seed = parse(arg[3], 65535)
local repetitions = parse(arg[4], 4294967295)
if repetitions == 0 or (which == "fib" and n > 40) then
    error("repetitions must be positive; fib n must be at most 40")
end
local warmups = parse(os.getenv("BENCH_WARMUP_BATCHES") or "1", 1000)
if warmups == 0 then error("BENCH_WARMUP_BATCHES must be positive") end
local warmup_checksum
for _ = 1, warmups do warmup_checksum = batch(which, n, seed, repetitions) end
local start = clock.now_ns()
local checksum = batch(which, n, seed, repetitions)
local elapsed_ns = clock.now_ns() - start
if checksum ~= warmup_checksum then error("warmup checksum differs") end
io.write(string.format(
    '{"engine":"%s","case":"%s","n":%.0f,"seed":%.0f,"repetitions":%.0f,"checksum":%.0f,"elapsed_ns":%.0f}\n',
    engine, which, n, seed, repetitions, checksum, elapsed_ns))
