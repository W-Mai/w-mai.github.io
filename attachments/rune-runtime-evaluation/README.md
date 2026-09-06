# 实验数据与算法定义

实验日期：2026-09-05。文章固定评估 Rune 0.14.2。附件中的性能数值直接选取原始记录的实验字段，不包含命令路径或机器账户信息。

## 文件

| 文件 | 内容 |
| --- | --- |
| [algorithm-samples.csv](algorithm-samples.csv) | 正式 216 条样本，保留原采样顺序 |
| [preliminary-samples.csv](preliminary-samples.csv) | 较早的完整 216 条采样，不参与正文表格统计 |
| [algorithm-summary.csv](algorithm-summary.csv) | 正式样本的 24 组中位数、最小值、最大值、变异系数 |
| [experiment-config.json](experiment-config.json) | 环境、版本、构建选项、工作负载与测量限制 |
| [allocation-phases.json](allocation-phases.json) | 分配计量窗口及最小标量实例的驻留归属 |
| [targets.json](targets.json) | Wasm 执行断言、C3 镜像大小及配置 |
| [sha256.json](sha256.json) | 附件文件的 SHA-256 摘要 |

性能 CSV 中的 `elapsed_ns` 是完整计时批次的纳秒数，`repetitions` 为 128。`sample` 是原采样计划中的编号，行顺序才是打乱后的执行顺序。纳秒是输出单位，不表示时钟具有 1 ns 的实际分辨率。

正文每个表格单元按以下步骤得到：按 `engine` 与 `case` 分组，将每条 `elapsed_ns` 除以 `repetitions`，再取九条结果的中位数，最后除以 1000 转成微秒。汇总 CSV 中的耗时仍以纳秒为单位。`sample_cv` 是九个批次均值的样本标准差除以算术平均值，未做离群值剔除。

例如，可用 Python 标准库检查 Rune 排序的表格值：

```python
import csv
import statistics

with open("algorithm-samples.csv", newline="") as stream:
    rows = list(csv.DictReader(stream))

values = [
    int(row["elapsed_ns"]) / int(row["repetitions"])
    for row in rows
    if row["engine"] == "rune" and row["case"] == "sort"
]
assert len(values) == 9
print(f"{statistics.median(values) / 1000:.2f} us")
```

## 输入与算法

正式测试的初始 seed 为 17531，每批执行 128 次。批次内第 `rep` 次调用使用 `s = (seed + rep * 17) % 65536`，其中 `rep` 从 0 开始。

- `mix(n, s)`：以 `x=s, acc=0` 开始，重复 `n` 次计算 `x=(25173*x+13849)%65536` 和 `acc=(acc+x)%1000000007`，返回 `acc`。正式 `n=10000`。
- `fib(n, s)`：计算直接递归的 `f(n+s%3)`。`f(0)=0`、`f(1)=1`，其他输入返回 `f(k-1)+f(k-2)`，正式 `n=17`。没有手写记忆化或迭代替代。
- `sort(n, s)`：按同一线性同余规则生成 `n` 个元素，执行升序插入排序，再计算 `sum((i+1)*a[i])` 的模 1000000007 结果。实际实现逐项取模，正式 `n=128`。
- 批次 checksum 为各次结果的模 1000000007 累加和。所有正式样本的 checksum 均通过检查。

这些工作负载中的整数中间值可以由 JavaScript Number 精确表示，没有使用整数溢出或浮点舍入差异来改变计算结果。数组元素在 C/C++/Rust 中使用 u32，算术中间值使用 u64；Rune 使用有符号整数，Lua/JavaScript 按各自通常的数值语义执行。

六份源文件保持测试时的内容：

- [C](algorithms/bench.c)
- [C++](algorithms/bench.cpp)
- [Rust](algorithms/bench.rs)
- [Rune](algorithms/bench.rn)
- [Lua / LuaJIT](algorithms/bench.lua)
- [JavaScript / Node / Bun](algorithms/bench.js)

这些文件用于核对具体实现。附件不包括全部构建器、Lua 计时模块、Rune 宿主程序、离线依赖或 C3 兼容补丁，因此不是直接执行全部实验的一键包。Lua/LuaJIT 的原测试使用 `CLOCK_MONOTONIC` 计时模块，而非 `os.clock()` CPU 时间；C++ 使用 steady_clock，Rust/Rune 使用 Instant，Node/Bun 使用 process.hrtime.bigint()。

## 内存与目标数据

`allocation-phases.json` 的统计来自 64 位 host、debug 构建。`requested_bytes` 与 `released_bytes` 表示窗口内成功请求和释放的 Layout 字节累计量；`live_delta_bytes` 表示窗口前后的活跃请求差；`additional_peak_bytes` 表示相对窗口开始新增的活跃请求峰值。它们不包含分配器内部开销或栈，也不是物理内存测量。

标有 deserialize 的窗口不自动包含此前已读入的输入缓冲。销毁对象的窗口会出现负的 live 差量；这是归属核对，不应解释为测量异常。

Wasm 的 `memory_bytes_after_checks` 是线性内存页容量。C3 的应用镜像大小来自 ELF 生成的镜像，包含段头和对齐；静态 section 差量、固定堆缓冲和实际运行峰值是不同口径。C3 没有设备执行数据。
