use criterion::{criterion_group, criterion_main, Criterion};
use serde_json::Value;
use std::{fs, hint::black_box, path::PathBuf};

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("Failed to resolve project root")
        .to_path_buf()
}

fn load_json(relative_path: &str) -> Value {
    let path = project_root().join(relative_path);

    let content = fs::read_to_string(&path)
        .unwrap_or_else(|error| {
            panic!(
                "Failed to read JSON file: {}\nPath: {}",
                error,
                path.display()
            )
        });

    serde_json::from_str(&content)
        .unwrap_or_else(|error| {
            panic!(
                "Failed to parse JSON file: {}\nPath: {}",
                error,
                path.display()
            )
        })
}

fn load_validator() -> jsonschema::Validator {
    let schema = load_json("schema/page.schema.json");

    jsonschema::validator_for(&schema)
        .expect("Failed to compile JSON Schema")
}

fn benchmark_validation(c: &mut Criterion) {
    let validator = load_validator();

    let fixtures = [
        ("Small", "fixtures/page-small.json"),
        ("Medium", "fixtures/page-medium.json"),
        ("Large", "fixtures/page-large.json"),
        ("Huge", "fixtures/page-huge.json"),
    ];

    for (name, path) in fixtures {
        let page = load_json(path);

        println!(
            "Benchmarking {} ({})",
            name,
            path
        );

        c.bench_function(
            &format!("{} - validation only", name),
            |b| {
                b.iter(|| {
                    let result = validator.is_valid(black_box(&page));

                    black_box(result);
                });
            },
        );
    }
}

criterion_group!(benches, benchmark_validation);
criterion_main!(benches);