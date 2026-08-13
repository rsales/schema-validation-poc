use std::fs;

use page_engine::{
    CompiledSchema, ComponentSchema, PageNode, validate_page, validate_page_compiled,
};

const ITERATIONS: usize = 100_000;

fn main() {
    let schema_json = fs::read_to_string("page-engine/schema/component-schema.json")
        .expect("failed to read schema");

    let page_json =
        fs::read_to_string("page-engine/fixtures/page-small.json").expect("failed to read page");

    let schema: ComponentSchema =
        serde_json::from_str(&schema_json).expect("failed to parse schema");

    let page: PageNode = serde_json::from_str(&page_json).expect("failed to parse page");

    let compiled_schema = CompiledSchema::compile(&schema).expect("failed to compile schema");

    benchmark_baseline(&page, &schema);

    benchmark_compiled(&page, &compiled_schema);

    benchmark_parse(&page_json);

    benchmark_validation(&page, &compiled_schema);

    benchmark_serialize(&page, &compiled_schema);
}

fn benchmark_baseline(page: &PageNode, schema: &ComponentSchema) {
    for _ in 0..10_000 {
        std::hint::black_box(validate_page(page, schema));
    }

    let start = std::time::Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_page(page, schema));
    }

    print_result("Native Rust - baseline", start.elapsed());
}

fn benchmark_compiled(page: &PageNode, schema: &CompiledSchema) {
    for _ in 0..10_000 {
        std::hint::black_box(validate_page_compiled(page, schema));
    }

    let start = std::time::Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_page_compiled(page, schema));
    }

    print_result("Native Rust - compiled", start.elapsed());
}

fn benchmark_parse(page_json: &str) {
    for _ in 0..10_000 {
        let page: PageNode = serde_json::from_str(page_json).expect("failed to parse page");

        std::hint::black_box(page);
    }

    let start = std::time::Instant::now();

    for _ in 0..ITERATIONS {
        let page: PageNode = serde_json::from_str(page_json).expect("failed to parse page");

        std::hint::black_box(page);
    }

    print_result("Native Rust - JSON parse", start.elapsed());
}

fn benchmark_validation(page: &PageNode, schema: &CompiledSchema) {
    for _ in 0..10_000 {
        std::hint::black_box(validate_page_compiled(page, schema));
    }

    let start = std::time::Instant::now();

    for _ in 0..ITERATIONS {
        std::hint::black_box(validate_page_compiled(page, schema));
    }

    print_result("Native Rust - validation only", start.elapsed());
}

fn benchmark_serialize(page: &PageNode, schema: &CompiledSchema) {
    for _ in 0..10_000 {
        let result = validate_page_compiled(page, schema);

        std::hint::black_box(serde_json::to_string(&result).expect("failed to serialize result"));
    }

    let start = std::time::Instant::now();

    for _ in 0..ITERATIONS {
        let result = validate_page_compiled(page, schema);

        std::hint::black_box(serde_json::to_string(&result).expect("failed to serialize result"));
    }

    print_result("Native Rust - validation + JSON serialize", start.elapsed());
}

fn print_result(name: &str, elapsed: std::time::Duration) {
    let total_ms = elapsed.as_secs_f64() * 1000.0;

    let avg_ms = total_ms / ITERATIONS as f64;

    let throughput = ITERATIONS as f64 / elapsed.as_secs_f64();

    println!();
    println!("{name}");
    println!("{}", "-".repeat(name.len()));
    println!("iterations: {ITERATIONS}");
    println!("total:      {total_ms:.2} ms");
    println!("avg:        {avg_ms:.6} ms");
    println!("throughput: {throughput:.0} validations/sec");
}
