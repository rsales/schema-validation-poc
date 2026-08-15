use std::fs;
use std::time::{Duration, Instant};

use page_engine::{
    CompiledSchema, ComponentSchema, NodePath, PageChange, PageNode, affected_scope,
    validate_incremental, validate_page_compiled,
};

const ITERATIONS: usize = 100_000;

struct BenchmarkResult {
    change: &'static str,

    full_ms: f64,
    incremental_ms: f64,

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

    let json = fs::read_to_string(path).expect("failed to read schema");

    serde_json::from_str(&json).expect("failed to parse schema")
}

fn load_page(filename: &str) -> PageNode {
    let path = format!("{}/../fixtures/{}", env!("CARGO_MANIFEST_DIR"), filename);

    let json = fs::read_to_string(path).expect("failed to read page");

    serde_json::from_str(&json).expect("failed to parse page")
}

fn count_nodes(node: &PageNode) -> usize {
    1 + node.children.iter().map(count_nodes).sum::<usize>()
}

fn find_node_path_by_id(node: &PageNode, target_id: &str) -> Option<NodePath> {
    fn visit(node: &PageNode, target_id: &str, indexes: &mut Vec<usize>) -> Option<NodePath> {
        if node.id == target_id {
            return Some(NodePath::from_indexes(indexes.clone()));
        }

        for (index, child) in node.children.iter().enumerate() {
            indexes.push(index);

            if let Some(path) = visit(child, target_id, indexes) {
                return Some(path);
            }

            indexes.pop();
        }

        None
    }

    visit(node, target_id, &mut Vec::new())
}

fn find_first_node_path<F>(node: &PageNode, predicate: &F) -> Option<NodePath>
where
    F: Fn(&PageNode) -> bool,
{
    fn visit<F>(node: &PageNode, predicate: &F, indexes: &mut Vec<usize>) -> Option<NodePath>
    where
        F: Fn(&PageNode) -> bool,
    {
        if predicate(node) {
            return Some(NodePath::from_indexes(indexes.clone()));
        }

        for (index, child) in node.children.iter().enumerate() {
            indexes.push(index);

            if let Some(path) = visit(child, predicate, indexes) {
                return Some(path);
            }

            indexes.pop();
        }

        None
    }

    visit(node, predicate, &mut Vec::new())
}

fn get_node_mut<'a>(page: &'a mut PageNode, path: &NodePath) -> &'a mut PageNode {
    let mut current = page;

    for &index in &path.indexes {
        current = current.children.get_mut(index).expect("invalid node path");
    }

    current
}

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
    change_name: &'static str,
    change: PageChange,
) -> BenchmarkResult {
    let scope = affected_scope(page, schema, &change);

    let affected_paths = scope.len();

    assert!(affected_paths > 0, "change should affect at least one path");

    /*
     * Warmup
     */

    std::hint::black_box(validate_page_compiled(page, schema));

    std::hint::black_box(validate_incremental(page, schema, &change));

    /*
     * Full validation
     */

    let full_start = Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_page_compiled(page, schema));
    }

    let full_elapsed = full_start.elapsed();

    /*
     * Incremental validation
     */

    let incremental_start = Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_incremental(page, schema, &change));
    }

    let incremental_elapsed = incremental_start.elapsed();

    /*
     * Metrics
     */

    let full_seconds = full_elapsed.as_secs_f64();
    let incremental_seconds = incremental_elapsed.as_secs_f64();

    let full_throughput = ITERATIONS as f64 / full_seconds;
    let incremental_throughput = ITERATIONS as f64 / incremental_seconds;

    let speedup = full_seconds / incremental_seconds;

    BenchmarkResult {
        change: change_name,

        full_ms: duration_ms(full_elapsed),
        incremental_ms: duration_ms(incremental_elapsed),

        full_throughput,
        incremental_throughput,

        speedup,

        affected_paths,
    }
}

fn print_results(page_name: &str, page: &PageNode, results: &[BenchmarkResult]) {
    let nodes = count_nodes(page);

    println!();
    println!("{} ({} nodes)", page_name, nodes);
    println!("==============================================");

    println!();

    println!(
        "{:<16} {:>12} {:>14} {:>10} {:>10}",
        "Change", "Full", "Incremental", "Speedup", "Paths"
    );

    println!("----------------------------------------------------------------");

    for result in results {
        println!(
            "{:<16} {:>9.2} ms {:>9.2} ms {:>9.2}x {:>10}",
            result.change,
            result.full_ms,
            result.incremental_ms,
            result.speedup,
            result.affected_paths,
        );
    }

    println!();

    println!("Throughput (validations/sec)");
    println!("----------------------------");

    println!("{:<16} {:>16} {:>20}", "Change", "Full", "Incremental");

    println!("------------------------------------------------------------");

    for result in results {
        println!(
            "{:<16} {:>16.0} {:>20.0}",
            result.change, result.full_throughput, result.incremental_throughput,
        );
    }
}

fn benchmark_page(
    name: &str,
    page: &PageNode,
    schema: &CompiledSchema,
    changes: Vec<(&'static str, PageChange)>,
) {
    let mut results = Vec::new();

    for (change_name, change) in changes {
        results.push(benchmark_change(page, schema, change_name, change));
    }

    print_results(name, page, &results);
}

/*
 * ---------------------------------------------------------
 * Changes
 * ---------------------------------------------------------
 */

fn field_change(page: &mut PageNode) -> PageChange {
    /*
     * Prefer a heading inside a card because this represents
     * a realistic nested field edit.
     *
     * Fallback to any heading for smaller fixtures.
     */

    let path = find_first_node_path(page, &|node| {
        node.node_type == "heading" && node.id.starts_with("card-heading-")
    })
    .or_else(|| find_first_node_path(page, &|node| node.node_type == "heading"))
    .expect("fixture should contain a heading node");

    get_node_mut(page, &path).fields.insert(
        "text".into(),
        serde_json::Value::String("Updated heading".into()),
    );

    PageChange::field_changed(path)
}

fn node_added(page: &mut PageNode) -> PageChange {
    /*
     * Prefer grid because adding a child to a grid is a
     * representative structural edit.
     *
     * Fallback to any node that can accept children.
     */

    let parent_path = find_node_path_by_id(page, "grid-1")
        .or_else(|| find_first_node_path(page, &|node| node.node_type == "grid"))
        .or_else(|| find_first_node_path(page, &|node| !node.children.is_empty()))
        .expect("fixture should contain a suitable parent node");

    let parent = get_node_mut(page, &parent_path);

    let index = parent.children.len();

    let mut indexes = parent_path.indexes.clone();
    indexes.push(index);

    let path = NodePath::from_indexes(indexes);

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

    parent.children.push(new_card);

    PageChange::node_added(path)
}

fn node_removed(page: &mut PageNode) -> PageChange {
    /*
     * Prefer removing a card from a grid.
     *
     * We deliberately choose a node with a stable parent
     * rather than relying on a specific card ID.
     */

    let path = find_first_node_path(page, &|node| node.node_type == "card")
        .expect("fixture should contain a removable card");

    let index = *path.indexes.last().expect("node path should not be empty");

    get_parent_mut(page, &path).children.remove(index);

    PageChange::node_removed(path)
}

fn node_moved(page: &mut PageNode) -> PageChange {
    /*
     * Find a grid dynamically.
     */

    let parent_path = find_node_path_by_id(page, "grid-1")
        .or_else(|| find_first_node_path(page, &|node| node.node_type == "grid"))
        .expect("fixture should contain a grid");

    let parent = get_node_mut(page, &parent_path);

    assert!(
        parent.children.len() >= 2,
        "grid should contain at least two children"
    );

    let from_index = 0;
    let to_index = parent.children.len() - 1;

    let mut from_indexes = parent_path.indexes.clone();
    from_indexes.push(from_index);

    let mut to_indexes = parent_path.indexes.clone();
    to_indexes.push(to_index);

    let from = NodePath::from_indexes(from_indexes);
    let to = NodePath::from_indexes(to_indexes);

    let moved_node = parent.children.remove(from_index);

    parent.children.insert(to_index, moved_node);

    PageChange::node_moved(from, to)
}

/*
 * ---------------------------------------------------------
 * Main
 * ---------------------------------------------------------
 */

fn main() {
    println!("Page Engine - real editing benchmark");
    println!("======================================");

    println!("iterations: {}", ITERATIONS);

    let schema = load_schema();

    let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

    /*
     * -------------------------------------------------
     * Small
     * -------------------------------------------------
     */

    let mut small_field = load_page("page-small.json");

    let small_field_change = field_change(&mut small_field);

    benchmark_page(
        "Small",
        &small_field,
        &compiled,
        vec![("field change", small_field_change)],
    );

    /*
     * -------------------------------------------------
     * Large
     * -------------------------------------------------
     */

    let mut large_field = load_page("page-large.json");
    let large_field_change = field_change(&mut large_field);

    let mut large_added = load_page("page-large.json");
    let large_added_change = node_added(&mut large_added);

    let mut large_removed = load_page("page-large.json");
    let large_removed_change = node_removed(&mut large_removed);

    let mut large_moved = load_page("page-large.json");
    let large_moved_change = node_moved(&mut large_moved);

    benchmark_page(
        "Large",
        &large_field,
        &compiled,
        vec![
            ("field change", large_field_change),
            ("node added", large_added_change),
            ("node removed", large_removed_change),
            ("node moved", large_moved_change),
        ],
    );

    /*
     * -------------------------------------------------
     * XLarge
     * -------------------------------------------------
     */

    let mut xlarge_field = load_page("page-xlarge.json");
    let xlarge_field_change = field_change(&mut xlarge_field);

    let mut xlarge_added = load_page("page-xlarge.json");
    let xlarge_added_change = node_added(&mut xlarge_added);

    let mut xlarge_removed = load_page("page-xlarge.json");
    let xlarge_removed_change = node_removed(&mut xlarge_removed);

    let mut xlarge_moved = load_page("page-xlarge.json");
    let xlarge_moved_change = node_moved(&mut xlarge_moved);

    benchmark_page(
        "XLarge",
        &xlarge_field,
        &compiled,
        vec![
            ("field change", xlarge_field_change),
            ("node added", xlarge_added_change),
            ("node removed", xlarge_removed_change),
            ("node moved", xlarge_moved_change),
        ],
    );
}
