use std::io::{self, Read};

use page_engine::{ComponentSchema, PageNode, validate_page};

#[derive(serde::Deserialize)]
struct ValidationRequest {
    schema: ComponentSchema,
    page: PageNode,
}

fn main() {
    let mut input = String::new();

    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");

    let request: ValidationRequest =
        serde_json::from_str(&input).expect("invalid validation request");

    let result = validate_page(&request.page, &request.schema);

    println!(
        "{}",
        serde_json::to_string(&result).expect("failed to serialize validation result")
    );
}
