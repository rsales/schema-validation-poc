use page_engine::{
    CompiledSchema, ComponentSchema, NodePath, PageChange, PageNode, validate_incremental,
    validate_page_compiled,
};

use std::fs;
use std::time::Instant;

const ITERATIONS: usize = 100_000;

fn load_schema() -> ComponentSchema {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../schema/component-schema.json"
    );

    let schema = fs::read_to_string(path).expect("failed to read schema");

    serde_json::from_str(&schema).expect("failed to parse schema")
}

fn load_page() -> PageNode {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/page-large.json");

    let page = fs::read_to_string(path).expect("failed to read page");

    serde_json::from_str(&page).expect("failed to parse page")
}

fn main() {
    println!("Page Engine - full vs incremental benchmark");

    println!("=============================================");

    println!("iterations: {}", ITERATIONS);

    let schema = load_schema();

    let page = load_page();

    let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

    let change = PageChange::field_changed(NodePath::from_indexes(vec![0, 0]));

    /*
     * Warmup
     *
     * Run both paths once before measuring
     * to avoid including first-use effects
     * in the benchmark.
     */

    let _ = validate_page_compiled(&page, &compiled);

    let _ = validate_incremental(&page, &compiled, &change);

    /*
     * Full validation
     */

    let full_start = Instant::now();

    for _ in 0..ITERATIONS {
        let result = validate_page_compiled(&page, &compiled);

        std::hint::black_box(result);
    }

    let full_elapsed = full_start.elapsed();

    /*
     * Incremental validation
     */

    let incremental_start = Instant::now();

    for _ in 0..ITERATIONS {
        let result = validate_incremental(&page, &compiled, &change);

        std::hint::black_box(result);
    }

    let incremental_elapsed = incremental_start.elapsed();

    let full_ms = full_elapsed.as_secs_f64() * 1000.0;

    let incremental_ms = incremental_elapsed.as_secs_f64() * 1000.0;

    let full_throughput = ITERATIONS as f64 / full_elapsed.as_secs_f64();

    let incremental_throughput = ITERATIONS as f64 / incremental_elapsed.as_secs_f64();

    let speedup = full_elapsed.as_secs_f64() / incremental_elapsed.as_secs_f64();

    println!();

    println!(
        "{:<24} {:>12} {:>20}",
        "Implementation", "total", "throughput"
    );

    println!("--------------------------------------------------------");

    println!(
        "{:<24} {:>9.2} ms {:>16.0} validations/sec",
        "Full validation", full_ms, full_throughput
    );

    println!(
        "{:<24} {:>9.2} ms {:>16.0} validations/sec",
        "Incremental", incremental_ms, incremental_throughput
    );

    println!();

    println!("Incremental speedup: {:.2}x", speedup);
}
