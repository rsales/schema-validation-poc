use jsonschema::Validator;
use serde_json::Value;
use std::fs;
use std::hint::black_box;
use std::process::Command;
use std::time::Instant;

const RUNS: usize = 50;

struct Fixture {
    name: &'static str,
    path: &'static str,
    blocks: usize,
    warmup: usize,
    iterations: usize,
}

#[derive(Debug, Clone, Copy)]
struct MemorySnapshot {
    rss_mb: f64,
    heap_mb: f64,
}

#[derive(Debug)]
struct MemoryResult {
    fixture: &'static str,
    baseline: MemorySnapshot,
    after_validator: MemorySnapshot,
    after_fixture: MemorySnapshot,
    after_warmup: MemorySnapshot,
    peak: MemorySnapshot,
    final_memory: MemorySnapshot,
}

fn format_number(value: usize) -> String {
    let value = value.to_string();

    let mut result = String::new();

    for (index, character) in value.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            result.push(',');
        }

        result.push(character);
    }

    result.chars().rev().collect()
}

fn format_mb(value: f64) -> String {
    format!("{value:.2} MB")
}

fn file_size_kb(path: &str) -> f64 {
    let metadata = fs::metadata(path).unwrap_or_else(|error| {
        panic!(
            "Failed to read metadata for '{}': {}",
            path,
            error
        );
    });

    metadata.len() as f64 / 1024.0
}

fn load_json(path: &str) -> Value {
    let content = fs::read_to_string(path).unwrap_or_else(|error| {
        panic!(
            "Failed to read JSON file '{}': {}",
            path,
            error
        );
    });

    serde_json::from_str(&content).unwrap_or_else(|error| {
        panic!(
            "Failed to parse JSON file '{}': {}",
            path,
            error
        );
    })
}

fn current_memory() -> MemorySnapshot {
    #[cfg(target_os = "macos")]
    {
        current_memory_macos()
    }

    #[cfg(target_os = "linux")]
    {
        current_memory_linux()
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        MemorySnapshot {
            rss_mb: 0.0,
            heap_mb: 0.0,
        }
    }
}

#[cfg(target_os = "macos")]
fn current_memory_macos() -> MemorySnapshot {
    use std::mem;

    #[repr(C)]
    struct RUsage {
        ru_utime: [i64; 2],
        ru_stime: [i64; 2],
        ru_maxrss: i64,
        ru_ixrss: i64,
        ru_idrss: i64,
        ru_isrss: i64,
        ru_minflt: i64,
        ru_majflt: i64,
        ru_nswap: i64,
        ru_inblock: i64,
        ru_oublock: i64,
        ru_msgsnd: i64,
        ru_msgrcv: i64,
        ru_nsignals: i64,
        ru_nvcsw: i64,
        ru_nivcsw: i64,
    }

    unsafe extern "C" {
        fn getrusage(
            who: i32,
            usage: *mut RUsage,
        ) -> i32;
    }

    const RUSAGE_SELF: i32 = 0;

    let mut usage = unsafe {
        mem::zeroed::<RUsage>()
    };

    let result = unsafe {
        getrusage(
            RUSAGE_SELF,
            &mut usage,
        )
    };

    if result != 0 {
        return MemorySnapshot {
            rss_mb: 0.0,
            heap_mb: 0.0,
        };
    }

    // macOS reports ru_maxrss in bytes.
    let rss_mb =
        usage.ru_maxrss as f64 / 1024.0 / 1024.0;

    MemorySnapshot {
        rss_mb,
        heap_mb: 0.0,
    }
}

#[cfg(target_os = "linux")]
fn current_memory_linux() -> MemorySnapshot {
    let status =
        fs::read_to_string("/proc/self/status")
            .unwrap_or_default();

    let rss_kb = status
        .lines()
        .find_map(|line| {
            line.strip_prefix("VmRSS:")
                .and_then(|value| {
                    value
                        .trim()
                        .strip_suffix(" kB")
                        .and_then(|value| {
                            value
                                .trim()
                                .parse::<f64>()
                                .ok()
                        })
                })
        })
        .unwrap_or(0.0);

    MemorySnapshot {
        rss_mb: rss_kb / 1024.0,
        heap_mb: 0.0,
    }
}

fn peak_memory(
    current: MemorySnapshot,
    previous: MemorySnapshot,
) -> MemorySnapshot {
    MemorySnapshot {
        rss_mb: current.rss_mb.max(previous.rss_mb),
        heap_mb: current.heap_mb.max(previous.heap_mb),
    }
}

fn run_fixture_in_child(
    fixture: &Fixture,
) -> MemoryResult {
    let executable =
        std::env::current_exe()
            .expect(
                "Failed to determine current executable"
            );

    let output = Command::new(executable)
        .arg("--worker")
        .arg(fixture.name)
        .arg(fixture.path)
        .arg(fixture.warmup.to_string())
        .arg(fixture.iterations.to_string())
        .output()
        .unwrap_or_else(|error| {
            panic!(
                "Failed to start memory worker for {}: {}",
                fixture.name,
                error
            );
        });

    if !output.status.success() {
        eprintln!(
            "\n--- Memory worker stdout ({}) ---\n{}",
            fixture.name,
            String::from_utf8_lossy(
                &output.stdout
            )
        );

        eprintln!(
            "\n--- Memory worker stderr ({}) ---\n{}",
            fixture.name,
            String::from_utf8_lossy(
                &output.stderr
            )
        );

        panic!(
            "Memory benchmark failed for {} with status {}",
            fixture.name,
            output.status
        );
    }

    let stdout =
        String::from_utf8_lossy(
            &output.stdout
        );

    parse_memory_result(
        &stdout,
        fixture.name,
    )
}

fn parse_memory_result(
    stdout: &str,
    fixture_name: &'static str,
) -> MemoryResult {
    let values: Vec<f64> = stdout
        .lines()
        .filter_map(|line| {
            line.trim()
                .parse::<f64>()
                .ok()
        })
        .collect();

    if values.len() != 12 {
        panic!(
            "Invalid memory worker output for {}.\n\
             Expected 12 numeric values, got {}.\n\
             Output:\n{}",
            fixture_name,
            values.len(),
            stdout
        );
    }

    MemoryResult {
        fixture: fixture_name,

        baseline: MemorySnapshot {
            rss_mb: values[0],
            heap_mb: values[1],
        },

        after_validator: MemorySnapshot {
            rss_mb: values[2],
            heap_mb: values[3],
        },

        after_fixture: MemorySnapshot {
            rss_mb: values[4],
            heap_mb: values[5],
        },

        after_warmup: MemorySnapshot {
            rss_mb: values[6],
            heap_mb: values[7],
        },

        peak: MemorySnapshot {
            rss_mb: values[8],
            heap_mb: values[9],
        },

        final_memory: MemorySnapshot {
            rss_mb: values[10],
            heap_mb: values[11],
        },
    }
}

fn run_worker() {
    let args: Vec<String> =
        std::env::args().collect();

    if args.len() != 6 {
        panic!(
            "Invalid worker arguments.\n\
             Expected:\n\
             --worker <name> <fixture> <warmup> <iterations>"
        );
    }

    let fixture_name =
        &args[2];

    let fixture_path =
        &args[3];

    let warmup: usize =
        args[4]
            .parse()
            .expect(
                "Invalid warmup value"
            );

    let iterations: usize =
        args[5]
            .parse()
            .expect(
                "Invalid iterations value"
            );

    eprintln!(
        "      Fixture: {}",
        fixture_name
    );

    eprintln!(
        "      Iterations: {}",
        format_number(iterations)
    );

    eprintln!(
        "      Warmup: {}",
        format_number(warmup)
    );

    eprintln!();

    // -----------------------------------------
    // Baseline
    // -----------------------------------------

    let baseline =
        current_memory();

    eprintln!(
        "      Baseline RSS: {}",
        format_mb(
            baseline.rss_mb
        )
    );

    // -----------------------------------------
    // Validator
    // -----------------------------------------

    eprintln!(
        "      Loading validator..."
    );

    let schema =
        load_json(
            "schema/page.schema.json"
        );

    let validator =
        Validator::new(&schema)
            .expect(
                "Failed to initialize JSON Schema validator"
            );

    let after_validator =
        current_memory();

    eprintln!(
        "      After validator RSS: {}",
        format_mb(
            after_validator.rss_mb
        )
    );

    // -----------------------------------------
    // Fixture
    // -----------------------------------------

    eprintln!(
        "      Loading fixture..."
    );

    let page =
        load_json(fixture_path);

    let after_fixture =
        current_memory();

    eprintln!(
        "      After fixture RSS: {}",
        format_mb(
            after_fixture.rss_mb
        )
    );

    // -----------------------------------------
    // Warmup
    // -----------------------------------------

    eprintln!(
        "      Warmup: {}",
        format_number(warmup)
    );

    for _ in 0..warmup {
        black_box(
            validator.is_valid(
                black_box(&page)
            )
        );
    }

    let after_warmup =
        current_memory();

    eprintln!(
        "      After warmup RSS: {}",
        format_mb(
            after_warmup.rss_mb
        )
    );

    // -----------------------------------------
    // Benchmark
    // -----------------------------------------

    let mut peak =
        after_warmup;

    for run in 1..=RUNS {
        let start =
            Instant::now();

        for _ in 0..iterations {
            let result =
                validator.is_valid(
                    black_box(&page)
                );

            black_box(result);
        }

        let duration =
            start.elapsed();

        let memory =
            current_memory();

        peak =
            peak_memory(
                memory,
                peak,
            );

        eprintln!(
            "      Run {}/{}: {:.3} ms | RSS {}",
            run,
            RUNS,
            duration.as_secs_f64() * 1000.0,
            format_mb(
                memory.rss_mb
            )
        );
    }

    let final_memory =
        current_memory();

    eprintln!();

    eprintln!(
        "      Peak RSS: {}",
        format_mb(
            peak.rss_mb
        )
    );

    eprintln!(
        "      Final RSS: {}",
        format_mb(
            final_memory.rss_mb
        )
    );

    // stdout is reserved for
    // machine-readable values.

    println!(
        "{}",
        baseline.rss_mb
    );

    println!(
        "{}",
        baseline.heap_mb
    );

    println!(
        "{}",
        after_validator.rss_mb
    );

    println!(
        "{}",
        after_validator.heap_mb
    );

    println!(
        "{}",
        after_fixture.rss_mb
    );

    println!(
        "{}",
        after_fixture.heap_mb
    );

    println!(
        "{}",
        after_warmup.rss_mb
    );

    println!(
        "{}",
        after_warmup.heap_mb
    );

    println!(
        "{}",
        peak.rss_mb
    );

    println!(
        "{}",
        peak.heap_mb
    );

    println!(
        "{}",
        final_memory.rss_mb
    );

    println!(
        "{}",
        final_memory.heap_mb
    );
}

fn print_results(
    results: &[MemoryResult],
) {
    println!();
    println!("Memory Results");
    println!("==============");
    println!();

    println!(
        "{:<10} {:>14} {:>15} {:>14} {:>14} {:>14} {:>14} {:>14} {:>14}",
        "Fixture",
        "Baseline RSS",
        "Validator RSS",
        "Fixture RSS",
        "After Warmup",
        "Peak RSS",
        "Final RSS",
        "RSS Delta",
        "Heap Delta",
    );

    println!(
        "---------- -------------- --------------- -------------- -------------- -------------- -------------- -------------- --------------"
    );

    for result in results {
        let rss_delta =
            result.peak.rss_mb -
            result.baseline.rss_mb;

        let heap_delta =
            result.peak.heap_mb -
            result.baseline.heap_mb;

        println!(
            "{:<10} {:>11.2} MB {:>12.2} MB {:>11.2} MB {:>11.2} MB {:>11.2} MB {:>11.2} MB {:>11.2} MB {:>11.2} MB",
            result.fixture,
            result.baseline.rss_mb,
            result.after_validator.rss_mb,
            result.after_fixture.rss_mb,
            result.after_warmup.rss_mb,
            result.peak.rss_mb,
            result.final_memory.rss_mb,
            rss_delta,
            heap_delta,
        );
    }

    println!();

    println!(
        "Note: RSS represents process-level memory usage and may include"
    );

    println!(
        "runtime, allocator, native memory, and validator memory."
    );

    println!(
        "Rust heap usage is not reported separately in this benchmark."
    );
}

fn main() {
    let args: Vec<String> =
        std::env::args().collect();

    if args.get(1).map(String::as_str)
        == Some("--worker")
    {
        run_worker();
        return;
    }

    println!(
        "Rust Native JSON Schema Memory Benchmark"
    );

    println!(
        "========================================="
    );

    println!();

    println!(
        "Runs: {}",
        RUNS
    );

    println!();

    println!("Memory Metrics");
    println!("==============");
    println!();

    println!("Baseline RSS");
    println!(
        "  Process memory before loading the validator."
    );

    println!();

    println!("Validator RSS");
    println!(
        "  Process memory after validator initialization."
    );

    println!();

    println!("Fixture RSS");
    println!(
        "  Process memory after fixture initialization."
    );

    println!();

    println!("After Warmup");
    println!(
        "  Process memory after warmup validations."
    );

    println!();

    println!("Peak RSS");
    println!(
        "  Highest process memory observed during the benchmark."
    );

    println!();

    println!("Final RSS");
    println!(
        "  Process memory observed after all benchmark runs."
    );

    println!();

    println!("RSS Delta");
    println!(
        "  Peak RSS minus Baseline RSS."
    );

    println!();

    println!(
        "Note: RSS represents process-level memory usage and may include"
    );

    println!(
        "runtime, allocator, native memory, and validator memory."
    );

    println!();

    let fixtures = [
        Fixture {
            name: "Small",
            path: "fixtures/page-small.json",
            blocks: 2,
            warmup: 10_000,
            iterations: 100_000,
        },
        Fixture {
            name: "Medium",
            path: "fixtures/page-medium.json",
            blocks: 50,
            warmup: 10_000,
            iterations: 10_000,
        },
        Fixture {
            name: "Large",
            path: "fixtures/page-large.json",
            blocks: 500,
            warmup: 1_000,
            iterations: 1_000,
        },
        Fixture {
            name: "Huge",
            path: "fixtures/page-huge.json",
            blocks: 5_000,
            warmup: 100,
            iterations: 100,
        },
    ];

    let mut results =
        Vec::with_capacity(
            fixtures.len()
        );

    for fixture in &fixtures {
        println!(
            "Benchmarking {}...",
            fixture.name
        );

        println!(
            "      Size: {:.2} KB",
            file_size_kb(
                fixture.path
            )
        );

        println!(
            "      Blocks: {}",
            format_number(
                fixture.blocks
            )
        );

        println!();

        let result =
            run_fixture_in_child(
                fixture
            );

        results.push(result);

        println!();
    }

    print_results(&results);
}