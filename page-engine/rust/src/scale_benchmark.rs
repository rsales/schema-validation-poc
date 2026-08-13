use std::fs;
use std::time::Instant;

use page_engine::{CompiledSchema, NodePath, PageNode, validate_at, validate_page_compiled};

const ITERATIONS: usize = 100_000;

fn load_schema() -> page_engine::ComponentSchema {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../schema/component-schema.json"
    );

    let json = fs::read_to_string(path).expect("failed to read schema");

    serde_json::from_str(&json).expect("failed to parse schema")
}

fn load_page(filename: &str) -> PageNode {
    let path = format!("{}/../fixtures/{}", env!("CARGO_MANIFEST_DIR"), filename,);

    let json = fs::read_to_string(path).expect("failed to read page");

    serde_json::from_str(&json).expect("failed to parse page")
}

fn count_nodes(node: &PageNode) -> usize {
    1 + node.children.iter().map(count_nodes).sum::<usize>()
}

fn benchmark_full(page: &PageNode, schema: &CompiledSchema) -> u128 {
    let start = Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_page_compiled(page, schema));
    }

    start.elapsed().as_nanos()
}

fn benchmark_subtree(page: &PageNode, schema: &CompiledSchema, path: &NodePath) -> u128 {
    let start = Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_at(page, schema, path));
    }

    start.elapsed().as_nanos()
}

fn print_result(name: &str, total_ns: u128) {
    let total_ms = total_ns as f64 / 1_000_000.0;

    let avg_us = total_ns as f64 / ITERATIONS as f64 / 1_000.0;

    let throughput = ITERATIONS as f64 / (total_ns as f64 / 1_000_000_000.0);

    println!(
        "{:<26} {:>10.2} ms {:>12.0}/sec avg {:>8.3} µs",
        name, total_ms, throughput, avg_us,
    );
}

fn benchmark_page(name: &str, page: &PageNode, schema: &CompiledSchema, path: &NodePath) {
    let nodes = count_nodes(page);

    let full = benchmark_full(page, schema);

    let subtree = benchmark_subtree(page, schema, path);

    let speedup = full as f64 / subtree as f64;

    println!();
    println!("{} ({} nodes)", name, nodes,);

    println!("---------------------------------------------");

    print_result("Full validation", full);

    print_result("Subtree validation", subtree);

    println!("Speedup: {:.2}x", speedup,);
}

fn main() {
    let schema = load_schema();

    let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

    let small = load_page("page-small.json");

    let large = load_page("page-large.json");

    let xlarge = load_page("page-xlarge.json");

    /*
     * page-small:
     *
     * page
     * └── hero
     */
    let small_path = NodePath::from_indexes(vec![0]);

    /*
     * page-large:
     *
     * page
     * └── section-1
     *     └── grid-1
     *         └── card-3
     */
    let large_path = NodePath::from_indexes(vec![1, 1, 2]);

    /*
     * page-xlarge:
     *
     * page
     * └── section-10
     *     └── grid-10
     *         └── card
     */
    let xlarge_path = NodePath::from_indexes(vec![10, 0, 5]);

    assert!(small_path.get(&small).is_some());

    assert!(large_path.get(&large).is_some());

    assert!(xlarge_path.get(&xlarge).is_some());

    assert!(validate_page_compiled(&small, &compiled,).valid);

    assert!(validate_page_compiled(&large, &compiled,).valid);

    assert!(validate_page_compiled(&xlarge, &compiled,).valid);

    assert!(validate_at(&small, &compiled, &small_path,).valid);

    assert!(validate_at(&large, &compiled, &large_path,).valid);

    assert!(validate_at(&xlarge, &compiled, &xlarge_path,).valid);

    println!("Page Engine - validation scaling");

    println!("================================");

    println!("iterations: {}", ITERATIONS);

    benchmark_page("Small", &small, &compiled, &small_path);

    benchmark_page("Large", &large, &compiled, &large_path);

    benchmark_page("XLarge", &xlarge, &compiled, &xlarge_path);
}
