use wasm_bindgen::prelude::*;

use crate::types::{
    ComponentSchema,
    PageNode,
};

#[wasm_bindgen]
pub fn validate_page(
    schema_json: &str,
    page_json: &str,
) -> Result<String, JsValue> {
    let schema: ComponentSchema =
        serde_json::from_str(schema_json)
            .map_err(|error| {
                JsValue::from_str(
                    &format!(
                        "Invalid schema JSON: {error}"
                    ),
                )
            })?;

    let page: PageNode =
        serde_json::from_str(page_json)
            .map_err(|error| {
                JsValue::from_str(
                    &format!(
                        "Invalid page JSON: {error}"
                    ),
                )
            })?;

    let result =
        crate::validator::validate_page(
            &page,
            &schema,
        );

    serde_json::to_string(&result)
        .map_err(|error| {
            JsValue::from_str(
                &format!(
                    "Failed to serialize validation result: {error}"
                ),
            )
        })
}