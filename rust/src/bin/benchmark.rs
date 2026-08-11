use jsonschema::Validator;
use serde_json::Value;
use std::fs;
use std::hint::black_box;
use std::path::Path;
use std::time::{Duration, Instant};

const RUNS: usize = 50;

struct Fixture {
    name: &'static str,
    path: &'static str,
    blocks: usize,
    warmup: usize,
    iterations: usize,
}

struct BenchmarkResult {
    fixture: &'static str,
    size_kb: f64,
    blocks: usize,
    iterations: usize,
    avg_ms: f64,
    avg_us: f64,
    p95_us: f64,
    ops_per_sec: f64,
}

fn load_json(path: &str) -> Value {
    let content = fs::read_to_string(path).unwrap_or_else(|error| {
        panic!("Failed to read JSON file '{}': {}", path, error);
    });

    serde_json::from_str(&content).unwrap_or_else(|error| {
        panic!("Failed to parse JSON file '{}': {}", path, error);
    })
}

fn percentile(values: &[f64], percentile: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }

    let mut sorted = values.to_vec();

    sorted.sort_by(|a, b| {
        a.partial_cmp(b).unwrap()
    });

    let index =
        ((sorted.len() as f64 - 1.0) * percentile).round() as usize;

    sorted[index]
}

fn file_size_kb(path: &str) -> f64 {
    let metadata = fs::metadata(path).unwrap_or_else(|error| {
        panic!("Failed to read metadata for '{}': {}", path, error);
    });

    metadata.len() as f64 / 1024.0
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

fn format_ops_per_sec(value: f64) -> String {
    let rounded = value.round() as u64;

    let value = rounded.to_string();

    let mut result = String::new();

    for (index, character) in value.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            result.push(',');
        }

        result.push(character);
    }

    result.chars().rev().collect()
}

fn benchmark_fixture(
    validator: &Validator,
    fixture: &Fixture,
) -> BenchmarkResult {
    println!("      Size: {:.2} KB", file_size_kb(fixture.path));

    let size_kb = file_size_kb(fixture.path);

    println!("      Blocks: {}", format_number(fixture.blocks));

    println!(
        "      Warmup: {}",
        format_number(fixture.warmup)
    );

    println!(
        "      Iterations: {}",
        format_number(fixture.iterations)
    );

    let page = load_json(fixture.path);

    println!();
    println!("      Page initialized.");
    println!();

    println!("      Warmup...");

    for _ in 0..fixture.warmup {
        black_box(
            validator.is_valid(
                black_box(&page)
            )
        );
    }

    println!("      Warmup completed.");
    println!();

    let mut durations = Vec::with_capacity(RUNS);
    let mut total_validations = 0usize;

    for run in 1..=RUNS {
        print!("      Run {}/{}...", run, RUNS);

        let start = Instant::now();

        for _ in 0..fixture.iterations {
            let result = validator.is_valid(
                black_box(&page)
            );

            black_box(result);
        }

        let duration = start.elapsed();

        let duration_ms =
            duration.as_secs_f64() * 1000.0;

        println!(" {:.3} ms", duration_ms);

        durations.push(duration.as_secs_f64());

        total_validations += fixture.iterations;
    }

    let total_duration_seconds =
        durations.iter().sum::<f64>();

    println!();
    println!(
        "      ✓ Completed in {:.2}s",
        total_duration_seconds
    );

    println!(
        "      Validations: {}",
        format_number(total_validations)
    );

    let total_duration = Duration::from_secs_f64(
        total_duration_seconds
    );

    let avg_duration_seconds =
        total_duration.as_secs_f64() / RUNS as f64;

    let avg_ms =
        avg_duration_seconds * 1_000.0;

    let avg_us =
        avg_duration_seconds * 1_000_000.0;

    let duration_us: Vec<f64> = durations
        .iter()
        .map(|seconds| seconds * 1_000_000.0)
        .collect();

    let p95_us =
        percentile(&duration_us, 0.95);

    let ops_per_sec =
        total_validations as f64
            / total_duration.as_secs_f64();

    BenchmarkResult {
        fixture: fixture.name,
        size_kb,
        blocks: fixture.blocks,
        iterations: fixture.iterations,
        avg_ms,
        avg_us,
        p95_us,
        ops_per_sec,
    }
}

fn print_results(results: &[BenchmarkResult]) {
    println!();
    println!("Benchmark Results");
    println!("=================");
    println!();

    println!(
        "{:<10} {:>10} {:>8} {:>12} {:>12} {:>12} {:>12} {:>14}",
        "Fixture",
        "Size",
        "Blocks",
        "Iterations",
        "Avg (ms)",
        "Avg (μs)",
        "P95 (μs)",
        "Ops/sec"
    );

    println!(
        "---------- ---------- -------- ------------ ------------ ------------ ------------ ---------------"
    );

    for result in results {
        println!(
            "{:<10} {:>9.2} KB {:>8} {:>12} {:>12.3} {:>12.3} {:>12.3} {:>14}",
            result.fixture,
            result.size_kb,
            format_number(result.blocks),
            format_number(result.iterations),
            result.avg_ms,
            result.avg_us,
            result.p95_us,
            format_ops_per_sec(result.ops_per_sec)
        );
    }
}

fn main() {
    println!("Rust Native JSON Schema Benchmark");
    println!("=================================");
    println!();
    println!("Runs: {}", RUNS);
    println!();

    let schema_path =
        Path::new("schema/page.schema.json");

    if !schema_path.exists() {
        panic!(
            "Schema file not found: {}",
            schema_path.display()
        );
    }

    let schema =
        load_json(schema_path.to_str().unwrap());

    println!("Initializing validator...");

    let validator =
        Validator::new(&schema)
            .expect(
                "Failed to initialize JSON Schema validator"
            );

    println!("Validator initialized.");
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
        Vec::with_capacity(fixtures.len());

    for (index, fixture) in fixtures.iter().enumerate() {
        println!(
            "[{}/{}] {}",
            index + 1,
            fixtures.len(),
            fixture.name
        );

        let result =
            benchmark_fixture(
                &validator,
                fixture
            );

        results.push(result);

        println!();
    }

    print_results(&results);
}