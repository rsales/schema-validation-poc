use std::fs;
use std::path::PathBuf;

use page_engine::{
    validate_page,
    validate_page_compiled,
    CompiledSchema,
    ComponentSchema,
    PageNode,
};

const ITERATIONS: usize = 100_000;

fn project_path(relative_path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(relative_path)
}

fn main() {
    let schema_path =
        project_path("schema/component-schema.json");

    let page_path =
        project_path("fixtures/page-small.json");

    let schema_json =
        fs::read_to_string(&schema_path)
            .expect("failed to read schema");

    let page_json =
        fs::read_to_string(&page_path)
            .expect("failed to read page");

    let schema: ComponentSchema =
        serde_json::from_str(&schema_json)
            .expect("failed to parse schema");

    let page: PageNode =
        serde_json::from_str(&page_json)
            .expect("failed to parse page");

    let compiled_schema =
        CompiledSchema::compile(&schema)
            .expect("failed to compile schema");

    benchmark_baseline(
        &page,
        &schema,
    );

    benchmark_compiled(
        &page,
        &compiled_schema,
    );
}

fn benchmark_baseline(
    page: &PageNode,
    schema: &ComponentSchema,
) {
    for _ in 0..10_000 {
        validate_page(
            page,
            schema,
        );
    }

    let start =
        std::time::Instant::now();

    for _ in 0..ITERATIONS {
        validate_page(
            page,
            schema,
        );
    }

    let elapsed =
        start.elapsed();

    let total_ms =
        elapsed.as_secs_f64() * 1000.0;

    let avg_ms =
        total_ms / ITERATIONS as f64;

    let throughput =
        ITERATIONS as f64
            / elapsed.as_secs_f64();

    println!();
    println!("Native Rust - baseline");
    println!("-------------------------");
    println!(
        "iterations: {}",
        ITERATIONS
    );
    println!(
        "total:      {:.2} ms",
        total_ms
    );
    println!(
        "avg:        {:.6} ms",
        avg_ms
    );
    println!(
        "throughput: {:.0} validations/sec",
        throughput
    );
}

fn benchmark_compiled(
    page: &PageNode,
    schema: &CompiledSchema,
) {
    for _ in 0..10_000 {
        validate_page_compiled(
            page,
            schema,
        );
    }

    let start =
        std::time::Instant::now();

    for _ in 0..ITERATIONS {
        validate_page_compiled(
            page,
            schema,
        );
    }

    let elapsed =
        start.elapsed();

    let total_ms =
        elapsed.as_secs_f64() * 1000.0;

    let avg_ms =
        total_ms / ITERATIONS as f64;

    let throughput =
        ITERATIONS as f64
            / elapsed.as_secs_f64();

    println!();
    println!("Native Rust - compiled");
    println!("-------------------------");
    println!(
        "iterations: {}",
        ITERATIONS
    );
    println!(
        "total:      {:.2} ms",
        total_ms
    );
    println!(
        "avg:        {:.6} ms",
        avg_ms
    );
    println!(
        "throughput: {:.0} validations/sec",
        throughput
    );
}