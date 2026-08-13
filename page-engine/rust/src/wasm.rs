use wasm_bindgen::prelude::*;

use crate::compiled::CompiledSchema;
use crate::types::{
    ComponentSchema,
    PageNode,
};

/// Baseline WASM API.
///
/// Compiles the schema and parses the page on every call.
/// Kept intentionally for benchmark comparison.
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

/// Compiled WASM validator.
///
/// The schema is parsed and compiled exactly once
/// when the validator is created.
///
/// Subsequent calls only parse the page and execute
/// the compiled validation rules.
#[wasm_bindgen]
pub struct PageValidator {
    schema: CompiledSchema,
}

#[wasm_bindgen]
impl PageValidator {
    /// Creates a compiled validator from a schema JSON.
    ///
    /// Schema parsing and regex compilation happen once.
    #[wasm_bindgen(constructor)]
    pub fn new(
        schema_json: &str,
    ) -> Result<PageValidator, JsValue> {
        let schema: ComponentSchema =
            serde_json::from_str(schema_json)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Invalid schema JSON: {error}"
                        ),
                    )
                })?;

        let compiled_schema =
            CompiledSchema::compile(&schema)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Failed to compile schema: {error}"
                        ),
                    )
                })?;

        Ok(Self {
            schema: compiled_schema,
        })
    }

    /// Validates a page using the compiled schema.
    ///
    /// The page is parsed on every call.
    #[wasm_bindgen]
    pub fn validate(
        &self,
        page_json: &str,
    ) -> Result<String, JsValue> {
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
            crate::validator::validate_page_compiled(
                &page,
                &self.schema,
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
}