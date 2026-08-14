use page_engine::{
    CompiledSchema, ComponentSchema, NodePath, PageChange, PageNode, affected_scope, validate_at,
    validate_incremental, validate_page_compiled,
};

use std::fs;
use std::time::{Duration, Instant};

const ITERATIONS: usize = 100_000;

struct BenchmarkResult {
    name: &'static str,

    full_ms: f64,
    incremental_ms: f64,

    scope_ms: f64,
    validation_ms: f64,

    full_throughput: f64,
    incremental_throughput: f64,

    speedup: f64,

    affected_paths: usize,
}

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

/// Resolve a mutable node from a NodePath.
fn get_node_mut<'a>(page: &'a mut PageNode, path: &NodePath) -> &'a mut PageNode {
    let mut current = page;

    for &index in &path.indexes {
        current = current.children.get_mut(index).expect("invalid node path");
    }

    current
}

/// Resolve the mutable parent of a node.
fn get_parent_mut<'a>(page: &'a mut PageNode, path: &NodePath) -> &'a mut PageNode {
    assert!(!path.indexes.is_empty(), "root node does not have a parent");

    let mut current = page;

    for &index in &path.indexes[..path.indexes.len() - 1] {
        current = current
            .children
            .get_mut(index)
            .expect("invalid parent path");
    }

    current
}

fn duration_ms(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

fn benchmark_change(
    page: &PageNode,
    schema: &CompiledSchema,
    name: &'static str,
    change: PageChange,
) -> BenchmarkResult {
    /*
     * -------------------------------------------------
     * Warmup
     * -------------------------------------------------
     */

    let _ = validate_page_compiled(page, schema);
    let _ = validate_incremental(page, schema, &change);

    /*
     * -------------------------------------------------
     * Resolve affected scope once
     * -------------------------------------------------
     *
     * This gives us visibility into how many paths
     * the incremental validator needs to validate.
     */

    let scope = affected_scope(page, schema, &change);

    let affected_paths = scope.len();

    /*
     * -------------------------------------------------
     * Full validation
     * -------------------------------------------------
     */

    let full_start = Instant::now();

    for _ in 0..ITERATIONS {
        let result = validate_page_compiled(page, schema);

        std::hint::black_box(result);
    }

    let full_elapsed = full_start.elapsed();

    /*
     * -------------------------------------------------
     * Incremental total
     * -------------------------------------------------
     */

    let incremental_start = Instant::now();

    for _ in 0..ITERATIONS {
        let result = validate_incremental(page, schema, &change);

        std::hint::black_box(result);
    }

    let incremental_elapsed = incremental_start.elapsed();

    /*
     * -------------------------------------------------
     * Scope resolution
     * -------------------------------------------------
     *
     * Measure the cost of affected_scope() separately.
     */

    let scope_start = Instant::now();

    for _ in 0..ITERATIONS {
        let result = affected_scope(page, schema, &change);

        std::hint::black_box(result);
    }

    let scope_elapsed = scope_start.elapsed();

    /*
     * -------------------------------------------------
     * Validation only
     * -------------------------------------------------
     *
     * Reuse the resolved scope so that this measurement
     * excludes affected_scope().
     */

    let validation_start = Instant::now();

    for _ in 0..ITERATIONS {
        let mut errors = Vec::new();

        for path in &scope {
            let result = validate_at(page, schema, path);

            errors.extend(result.errors);
        }

        std::hint::black_box(errors);
    }

    let validation_elapsed = validation_start.elapsed();

    /*
     * -------------------------------------------------
     * Metrics
     * -------------------------------------------------
     */

    let full_seconds = full_elapsed.as_secs_f64();
    let incremental_seconds = incremental_elapsed.as_secs_f64();

    let full_ms = duration_ms(full_elapsed);
    let incremental_ms = duration_ms(incremental_elapsed);

    let scope_ms = duration_ms(scope_elapsed);
    let validation_ms = duration_ms(validation_elapsed);

    let full_throughput = ITERATIONS as f64 / full_seconds;
    let incremental_throughput = ITERATIONS as f64 / incremental_seconds;

    let speedup = full_seconds / incremental_seconds;

    BenchmarkResult {
        name,

        full_ms,
        incremental_ms,

        scope_ms,
        validation_ms,

        full_throughput,
        incremental_throughput,

        speedup,

        affected_paths,
    }
}

fn print_scope(name: &str, page: &PageNode, schema: &CompiledSchema, change: &PageChange) {
    let scope = affected_scope(page, schema, change);

    println!();
    println!("Affected scope - {}", name);
    println!("---------------------------");

    for path in scope {
        println!("  {:#?}", path);
    }
}

fn main() {
    println!("Page Engine - incremental validation profiling");
    println!("==============================================");

    println!("iterations: {}", ITERATIONS);

    let schema = load_schema();

    let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

    /*
     * -------------------------------------------------
     * 1. Field change
     * -------------------------------------------------
     */

    let mut field_page = load_page();

    let field_path = NodePath::from_indexes(vec![0, 0]);

    get_node_mut(&mut field_page, &field_path).fields.insert(
        "text".into(),
        serde_json::Value::String("Updated heading".into()),
    );

    let field_change = PageChange::field_changed(field_path);

    /*
     * -------------------------------------------------
     * 2. Node added
     * -------------------------------------------------
     */

    let mut node_added_page = load_page();

    let node_added_path = NodePath::from_indexes(vec![1, 1, 6]);

    let new_card = PageNode {
        id: "benchmark-card".into(),
        node_type: "card".into(),
        fields: serde_json::json!({
            "title": "Benchmark Card"
        })
        .as_object()
        .unwrap()
        .clone()
        .into_iter()
        .collect(),
        children: vec![],
    };

    get_parent_mut(&mut node_added_page, &node_added_path)
        .children
        .insert(
            *node_added_path
                .indexes
                .last()
                .expect("node path should not be empty"),
            new_card,
        );

    let node_added_change = PageChange::node_added(node_added_path);

    /*
     * -------------------------------------------------
     * 3. Node removed
     * -------------------------------------------------
     */

    let mut node_removed_page = load_page();

    let node_removed_path = NodePath::from_indexes(vec![1, 1, 0]);

    get_parent_mut(&mut node_removed_page, &node_removed_path)
        .children
        .remove(
            *node_removed_path
                .indexes
                .last()
                .expect("node path should not be empty"),
        );

    let node_removed_change = PageChange::node_removed(node_removed_path);

    /*
     * -------------------------------------------------
     * 4. Node moved
     * -------------------------------------------------
     */

    let mut node_moved_page = load_page();

    let from = NodePath::from_indexes(vec![1, 1, 0]);
    let to = NodePath::from_indexes(vec![1, 1, 5]);

    let from_index = *from.indexes.last().expect("from path should not be empty");

    let to_index = *to.indexes.last().expect("to path should not be empty");

    let parent = get_parent_mut(&mut node_moved_page, &from);

    let moved_node = parent.children.remove(from_index);

    parent.children.insert(to_index, moved_node);

    let node_moved_change = PageChange::node_moved(from, to);

    /*
     * -------------------------------------------------
     * Print affected scopes
     * -------------------------------------------------
     */

    print_scope("field change", &field_page, &compiled, &field_change);

    print_scope(
        "node added",
        &node_added_page,
        &compiled,
        &node_added_change,
    );

    print_scope(
        "node removed",
        &node_removed_page,
        &compiled,
        &node_removed_change,
    );

    print_scope(
        "node moved",
        &node_moved_page,
        &compiled,
        &node_moved_change,
    );

    /*
     * -------------------------------------------------
     * Benchmarks
     * -------------------------------------------------
     */

    let results = vec![
        benchmark_change(&field_page, &compiled, "field change", field_change),
        benchmark_change(&node_added_page, &compiled, "node added", node_added_change),
        benchmark_change(
            &node_removed_page,
            &compiled,
            "node removed",
            node_removed_change,
        ),
        benchmark_change(&node_moved_page, &compiled, "node moved", node_moved_change),
    ];

    /*
     * -------------------------------------------------
     * Main benchmark
     * -------------------------------------------------
     */

    println!();
    println!("Benchmark Results");
    println!("=================");

    println!();

    println!(
        "{:<16} {:>12} {:>14} {:>10} {:>10}",
        "Change", "Full", "Incremental", "Speedup", "Paths"
    );

    println!("----------------------------------------------------------------");

    for result in &results {
        println!(
            "{:<16} {:>9.2} ms {:>9.2} ms {:>10.2}x {:>10}",
            result.name,
            result.full_ms,
            result.incremental_ms,
            result.speedup,
            result.affected_paths,
        );
    }

    /*
     * -------------------------------------------------
     * Incremental breakdown
     * -------------------------------------------------
     */

    println!();
    println!("Incremental Breakdown");
    println!("=====================");

    println!();

    println!(
        "{:<16} {:>16} {:>16} {:>16} {:>12}",
        "Change", "Scope", "Validation", "Total", "Paths",
    );

    println!("--------------------------------------------------------------------------");

    for result in &results {
        println!(
            "{:<16} {:>12.2} ms {:>12.2} ms {:>12.2} ms {:>12}",
            result.name,
            result.scope_ms,
            result.validation_ms,
            result.incremental_ms,
            result.affected_paths,
        );
    }

    /*
     * -------------------------------------------------
     * Throughput
     * -------------------------------------------------
     */

    println!();
    println!("Throughput (validations/sec)");
    println!("============================");

    println!();

    println!("{:<16} {:>16} {:>20}", "Change", "Full", "Incremental");

    println!("------------------------------------------------------------");

    for result in &results {
        println!(
            "{:<16} {:>16.0} {:>20.0}",
            result.name, result.full_throughput, result.incremental_throughput,
        );
    }
}
