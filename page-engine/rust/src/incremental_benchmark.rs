use std::fs;
use std::time::Instant;

use page_engine::{
    validate_at,
    validate_page_compiled,
    CompiledSchema,
    NodePath,
    PageNode,
};

const ITERATIONS: usize = 100_000;

fn load_schema() -> page_engine::ComponentSchema {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../schema/component-schema.json"
    );

    let json =
        fs::read_to_string(path)
            .expect("failed to read schema");

    serde_json::from_str(&json)
        .expect("failed to parse schema")
}

fn load_page() -> PageNode {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/page-large.json"
    );

    let json =
        fs::read_to_string(path)
            .expect("failed to read page");

    serde_json::from_str(&json)
        .expect("failed to parse page")
}

fn benchmark_full(
    page: &PageNode,
    schema: &CompiledSchema,
) -> u128 {
    let start =
        Instant::now();

    for _ in 0..ITERATIONS {
        let result =
            validate_page_compiled(
                page,
                schema,
            );

        std::hint::black_box(
            result,
        );
    }

    start.elapsed().as_nanos()
}

fn benchmark_subtree(
    page: &PageNode,
    schema: &CompiledSchema,
    path: &NodePath,
) -> u128 {
    let start =
        Instant::now();

    for _ in 0..ITERATIONS {
        let result =
            validate_at(
                page,
                schema,
                path,
            );

        std::hint::black_box(
            result,
        );
    }

    start.elapsed().as_nanos()
}

fn benchmark_lookup(
    page: &PageNode,
    path: &NodePath,
) -> u128 {
    let start =
        Instant::now();

    for _ in 0..ITERATIONS {
        let node =
            path.get(page);

        std::hint::black_box(
            node,
        );
    }

    start.elapsed().as_nanos()
}

fn benchmark_subtree_with_lookup(
    page: &PageNode,
    schema: &CompiledSchema,
    path: &NodePath,
) -> u128 {
    let start =
        Instant::now();

    for _ in 0..ITERATIONS {
        let node =
            std::hint::black_box(
                path.get(page),
            );

        if node.is_some() {
            let result =
                validate_at(
                    page,
                    schema,
                    path,
                );

            std::hint::black_box(
                result,
            );
        }
    }

    start.elapsed().as_nanos()
}

fn print_result(
    name: &str,
    total_ns: u128,
) {
    let total_ms =
        total_ns as f64 / 1_000_000.0;

    let avg_ms =
        total_ms / ITERATIONS as f64;

    let throughput =
        ITERATIONS as f64
            / (total_ns as f64 / 1_000_000_000.0);

    println!(
        "{:<28} {:>10.2} ms {:>12.0} validations/sec",
        name,
        total_ms,
        throughput,
    );

    println!(
        "{:<28} avg: {:>10.6} ms",
        "",
        avg_ms,
    );
}

fn main() {
    let schema =
        load_schema();

    let page =
        load_page();

    let compiled =
        CompiledSchema::compile(
            &schema,
        )
        .expect(
            "failed to compile schema",
        );

    /*
     * page
     * └── section-1       [1]
     *     └── grid-1      [1]
     *         └── card-3  [2]
     */
    let path =
        NodePath::from_indexes(
            vec![1, 1, 2],
        );

    let node =
        path.get(&page)
            .expect(
                "benchmark path must exist",
            );

    assert_eq!(
        node.id,
        "card-3",
    );

    let full_result =
        validate_page_compiled(
            &page,
            &compiled,
        );

    let subtree_result =
        validate_at(
            &page,
            &compiled,
            &path,
        );

    assert!(
        full_result.valid,
        "full page must be valid: {:?}",
        full_result.errors,
    );

    assert!(
        subtree_result.valid,
        "subtree must be valid: {:?}",
        subtree_result.errors,
    );

    println!(
        "Page Engine - incremental benchmark"
    );

    println!(
        "===================================="
    );

    println!(
        "iterations: {}",
        ITERATIONS
    );

    println!();

    println!(
        "{:<28} {:>10} {:>20}",
        "Implementation",
        "total",
        "throughput",
    );

    println!(
        "------------------------------------------------------------"
    );

    let full =
        benchmark_full(
            &page,
            &compiled,
        );

    print_result(
        "Full page validation",
        full,
    );

    let lookup =
        benchmark_lookup(
            &page,
            &path,
        );

    print_result(
        "Path lookup only",
        lookup,
    );

    let subtree =
        benchmark_subtree(
            &page,
            &compiled,
            &path,
        );

    print_result(
        "Subtree validation",
        subtree,
    );

    let subtree_lookup =
        benchmark_subtree_with_lookup(
            &page,
            &compiled,
            &path,
        );

    print_result(
        "Lookup + subtree validation",
        subtree_lookup,
    );
}