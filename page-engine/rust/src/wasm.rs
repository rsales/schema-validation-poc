use wasm_bindgen::prelude::*;

use crate::compiled::CompiledSchema;
use crate::types::{
    ComponentSchema,
    PageNode,
};

#[wasm_bindgen]
pub struct PageValidator {
    schema: CompiledSchema,
}

#[wasm_bindgen]
impl PageValidator {
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

        let schema =
            CompiledSchema::compile(&schema)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Failed to compile schema: {error}"
                        ),
                    )
                })?;

        Ok(Self {
            schema,
        })
    }

    #[wasm_bindgen]
    pub fn validate_data(
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

    #[wasm_bindgen]
    pub fn validate_many(
        &self,
        page_json: &str,
        iterations: u32,
    ) -> Result<bool, JsValue> {
        let page: PageNode =
            serde_json::from_str(page_json)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Invalid page JSON: {error}"
                        ),
                    )
                })?;

        let mut valid = true;

        for _ in 0..iterations {
            let result =
                crate::validator::validate_page_compiled(
                    &page,
                    &self.schema,
                );

            valid &= result.valid;
        }

        Ok(valid)
    }
}