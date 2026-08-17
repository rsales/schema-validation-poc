use wasm_bindgen::prelude::*;

use crate::change::PageChange;
use crate::compiled::CompiledSchema;
use crate::path::NodePath;
use crate::types::{
    PageNode,
    ValidationResult,
};

// ---------------------------------------------------------
// Panic hook: sem isso, panics em release viram um
// `RuntimeError: unreachable` sem mensagem nenhuma.
// ---------------------------------------------------------

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// ---------------------------------------------------------
// performance.now() do host JS
// ---------------------------------------------------------
//
// js_sys::Date::now() tem resolução insuficiente para medir
// operações na casa de microssegundos, como scope resolution
// e validação direcionada em páginas pequenas. performance.now()
// tem resolução sub-milissegundo e é o relógio correto para
// este tipo de benchmark.
//

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = performance)]
    fn now() -> f64;
}

#[derive(serde::Deserialize)]
#[serde(tag = "type")]
enum JsPageChange {
    #[serde(rename = "field_changed")]
    FieldChanged {
        path: Vec<usize>,
    },

    #[serde(rename = "node_added")]
    NodeAdded {
        path: Vec<usize>,
    },

    #[serde(rename = "node_removed")]
    NodeRemoved {
        path: Vec<usize>,
    },

    #[serde(rename = "node_moved")]
    NodeMoved {
        from: Vec<usize>,
        to: Vec<usize>,
    },
}

impl JsPageChange {
    fn into_page_change(self) -> PageChange {
        match self {
            Self::FieldChanged { path } => {
                PageChange::field_changed(
                    NodePath::from_indexes(path),
                )
            }

            Self::NodeAdded { path } => {
                PageChange::node_added(
                    NodePath::from_indexes(path),
                )
            }

            Self::NodeRemoved { path } => {
                PageChange::node_removed(
                    NodePath::from_indexes(path),
                )
            }

            Self::NodeMoved { from, to } => {
                PageChange::node_moved(
                    NodePath::from_indexes(from),
                    NodePath::from_indexes(to),
                )
            }
        }
    }
}

fn parse_change(
    change_json: &str,
) -> Result<PageChange, JsValue> {
    let change: JsPageChange =
        serde_json::from_str(change_json)
            .map_err(|error| {
                JsValue::from_str(
                    &format!(
                        "Invalid page change JSON: {error}"
                    ),
                )
            })?;

    Ok(change.into_page_change())
}

fn serialize_validation_result(
    result: &ValidationResult,
) -> Result<String, JsValue> {
    serde_json::to_string(result)
        .map_err(|error| {
            JsValue::from_str(
                &format!(
                    "Failed to serialize validation result: {error}"
                ),
            )
        })
}

#[derive(serde::Serialize)]
struct IncrementalProfile {
    total_ms: f64,
    scope_ms: f64,
    validation_ms: f64,
    affected_paths: usize,
}

fn serialize_incremental_profile(
    profile: &IncrementalProfile,
) -> Result<String, JsValue> {
    serde_json::to_string(profile)
        .map_err(|error| {
            JsValue::from_str(
                &format!(
                    "Failed to serialize incremental profile: {error}"
                ),
            )
        })
}

#[wasm_bindgen]
pub struct PageValidator {
    schema: CompiledSchema,
}

#[wasm_bindgen]
pub struct PageHandle {
    page: PageNode,
}

#[wasm_bindgen]
impl PageValidator {
    // ---------------------------------------------------------
    // Full validation from JSON
    // ---------------------------------------------------------

    #[wasm_bindgen]
    pub fn validate_json(
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

        serialize_validation_result(
            &result,
        )
    }

    // ---------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------

    #[wasm_bindgen(constructor)]
    pub fn new(
        schema_json: &str,
    ) -> Result<PageValidator, JsValue> {
        let schema =
            serde_json::from_str(schema_json)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Invalid schema JSON: {error}"
                        ),
                    )
                })?;

        let compiled =
            CompiledSchema::compile(&schema)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Failed to compile schema: {error}"
                        ),
                    )
                })?;

        Ok(PageValidator {
            schema: compiled,
        })
    }

    // ---------------------------------------------------------
    // Resident page
    // ---------------------------------------------------------

    #[wasm_bindgen]
    pub fn load_page(
        &self,
        page_json: &str,
    ) -> Result<PageHandle, JsValue> {
        let page: PageNode =
            serde_json::from_str(page_json)
                .map_err(|error| {
                    JsValue::from_str(
                        &format!(
                            "Invalid page JSON: {error}"
                        ),
                    )
                })?;

        Ok(PageHandle { page })
    }

    // ---------------------------------------------------------
    // Full validation
    // ---------------------------------------------------------

    #[wasm_bindgen]
    pub fn validate_resident(
        &self,
        page: &PageHandle,
    ) -> bool {
        crate::validator::validate_page_compiled(
            &page.page,
            &self.schema,
        )
        .valid
    }

    #[wasm_bindgen]
    pub fn validate_resident_many(
        &self,
        page: &PageHandle,
        iterations: u32,
    ) -> bool {
        let mut valid = true;

        for _ in 0..iterations {
            let result =
                crate::validator::validate_page_compiled(
                    &page.page,
                    &self.schema,
                );

            valid &= result.valid;
        }

        valid
    }

    // ---------------------------------------------------------
    // Incremental validation
    // ---------------------------------------------------------

    #[wasm_bindgen]
    pub fn validate_resident_incremental(
        &self,
        page: &PageHandle,
        change_json: &str,
    ) -> Result<String, JsValue> {
        let change =
            parse_change(change_json)?;

        let result =
            crate::incremental::validate_incremental(
                &page.page,
                &self.schema,
                &change,
            );

        serialize_validation_result(&result)
    }

    // ---------------------------------------------------------
    // Incremental profiling
    // ---------------------------------------------------------

    #[wasm_bindgen]
    pub fn profile_resident_incremental(
        &self,
        page: &PageHandle,
        change_json: &str,
    ) -> Result<String, JsValue> {
        let change = parse_change(change_json)?;

        // ---------------------------------------------------------
        // Scope resolution
        // ---------------------------------------------------------

        let scope_start = now();

        let scope =
            crate::scope::affected_scope(
                &page.page,
                &self.schema,
                &change,
            );

        let scope_elapsed = now() - scope_start;

        // ---------------------------------------------------------
        // Targeted validation
        // ---------------------------------------------------------
        //
        // Valida somente os nós afetados pelo change.
        //

        let validation_start = now();

        let mut errors = Vec::new();

        for path in &scope {
            let result =
                crate::validator::validate_at(
                    &page.page,
                    &self.schema,
                    path,
                );

            errors.extend(result.errors);
        }

        let validation_elapsed = now() - validation_start;

        // ---------------------------------------------------------
        // Total
        // ---------------------------------------------------------

        let total_elapsed = scope_elapsed + validation_elapsed;

        let profile =
            IncrementalProfile {
                total_ms: total_elapsed,
                scope_ms: scope_elapsed,
                validation_ms: validation_elapsed,
                affected_paths: scope.len(),
            };

        serialize_incremental_profile(
            &profile,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_field_changed() {
        let change: JsPageChange =
            serde_json::from_str(
                r#"{
                    "type": "field_changed",
                    "path": [0, 1, 2]
                }"#,
            )
            .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::field_changed(
                NodePath::from_indexes(
                    vec![0, 1, 2]
                )
            )
        );
    }

    #[test]
    fn converts_node_added() {
        let change: JsPageChange =
            serde_json::from_str(
                r#"{
                    "type": "node_added",
                    "path": [0, 2]
                }"#,
            )
            .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::node_added(
                NodePath::from_indexes(
                    vec![0, 2]
                )
            )
        );
    }

    #[test]
    fn converts_node_removed() {
        let change: JsPageChange =
            serde_json::from_str(
                r#"{
                    "type": "node_removed",
                    "path": [0, 3, 1]
                }"#,
            )
            .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::node_removed(
                NodePath::from_indexes(
                    vec![0, 3, 1]
                )
            )
        );
    }

    #[test]
    fn converts_node_moved() {
        let change: JsPageChange =
            serde_json::from_str(
                r#"{
                    "type": "node_moved",
                    "from": [0, 1],
                    "to": [0, 3]
                }"#,
            )
            .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::node_moved(
                NodePath::from_indexes(
                    vec![0, 1]
                ),
                NodePath::from_indexes(
                    vec![0, 3]
                ),
            )
        );
    }

    #[test]
    fn rejects_unknown_change_type() {
        let result =
            serde_json::from_str::<JsPageChange>(
                r#"{
                    "type": "unknown",
                    "path": [0, 1]
                }"#,
            );

        assert!(result.is_err());
    }

    #[test]
    fn parses_field_change() {
        let result =
            parse_change(
                r#"{
                    "type": "field_changed",
                    "path": [0, 1, 2]
                }"#,
            );

        assert!(result.is_ok());

        assert_eq!(
            result.unwrap(),
            PageChange::field_changed(
                NodePath::from_indexes(
                    vec![0, 1, 2]
                )
            )
        );
    }

    #[test]
    fn rejects_invalid_change_json() {
        let result =
            parse_change(
                r#"{
                    "type": "invalid",
                    "path": [0, 1]
                }"#,
            );

        assert!(result.is_err());
    }

    #[test]
    fn serializes_valid_validation_result() {
        let result = ValidationResult {
            valid: true,
            errors: vec![],
        };

        let serialized =
            serialize_validation_result(
                &result,
            )
            .expect(
                "failed to serialize validation result",
            );

        assert_eq!(
            serialized,
            r#"{"valid":true,"errors":[]}"#,
        );
    }

    #[test]
    fn serializes_incremental_profile() {
        let profile =
            IncrementalProfile {
                total_ms: 1.5,
                scope_ms: 0.5,
                validation_ms: 1.0,
                affected_paths: 3,
            };

        let serialized =
            serialize_incremental_profile(
                &profile,
            )
            .expect(
                "failed to serialize incremental profile",
            );

        assert_eq!(
            serialized,
            r#"{"total_ms":1.5,"scope_ms":0.5,"validation_ms":1.0,"affected_paths":3}"#,
        );
    }
}