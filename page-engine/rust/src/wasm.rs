use wasm_bindgen::prelude::*;

use crate::change::PageChange;
use crate::compiled::CompiledSchema;
use crate::path::NodePath;
use crate::types::{ComponentSchema, PageNode, ValidationResult};

#[derive(serde::Deserialize)]
#[serde(tag = "type")]
enum JsPageChange {
    #[serde(rename = "field_changed")]
    FieldChanged { path: Vec<usize> },

    #[serde(rename = "node_added")]
    NodeAdded { path: Vec<usize> },

    #[serde(rename = "node_removed")]
    NodeRemoved { path: Vec<usize> },

    #[serde(rename = "node_moved")]
    NodeMoved { from: Vec<usize>, to: Vec<usize> },
}

impl JsPageChange {
    fn into_page_change(self) -> PageChange {
        match self {
            Self::FieldChanged { path } => PageChange::field_changed(NodePath::from_indexes(path)),

            Self::NodeAdded { path } => PageChange::node_added(NodePath::from_indexes(path)),

            Self::NodeRemoved { path } => PageChange::node_removed(NodePath::from_indexes(path)),

            Self::NodeMoved { from, to } => {
                PageChange::node_moved(NodePath::from_indexes(from), NodePath::from_indexes(to))
            }
        }
    }
}

fn parse_change(change_json: &str) -> Result<PageChange, JsValue> {
    let change: JsPageChange = serde_json::from_str(change_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid page change JSON: {error}")))?;

    Ok(change.into_page_change())
}

fn serialize_validation_result(result: &ValidationResult) -> Result<String, JsValue> {
    serde_json::to_string(result).map_err(|error| {
        JsValue::from_str(&format!("Failed to serialize validation result: {error}"))
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
    #[wasm_bindgen(constructor)]
    pub fn new(schema_json: &str) -> Result<PageValidator, JsValue> {
        let schema: ComponentSchema = serde_json::from_str(schema_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid schema JSON: {error}")))?;

        let schema = CompiledSchema::compile(&schema)
            .map_err(|error| JsValue::from_str(&format!("Failed to compile schema: {error}")))?;

        Ok(Self { schema })
    }

    #[wasm_bindgen]
    pub fn validate_data(&self, page_json: &str) -> Result<String, JsValue> {
        let page: PageNode = serde_json::from_str(page_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid page JSON: {error}")))?;

        let result = crate::validator::validate_page_compiled(&page, &self.schema);

        serialize_validation_result(&result)
    }

    #[wasm_bindgen]
    pub fn validate_many(&self, page_json: &str, iterations: u32) -> Result<bool, JsValue> {
        let page: PageNode = serde_json::from_str(page_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid page JSON: {error}")))?;

        let mut valid = true;

        for _ in 0..iterations {
            let result = crate::validator::validate_page_compiled(&page, &self.schema);

            valid &= result.valid;
        }

        Ok(valid)
    }

    #[wasm_bindgen]
    pub fn parse_page(&self, page_json: &str) -> Result<(), JsValue> {
        serde_json::from_str::<PageNode>(page_json)
            .map(|_| ())
            .map_err(|error| JsValue::from_str(&format!("Invalid page JSON: {error}")))
    }

    #[wasm_bindgen]
    pub fn validate_and_serialize_many(
        &self,
        page_json: &str,
        iterations: u32,
    ) -> Result<usize, JsValue> {
        let page: PageNode = serde_json::from_str(page_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid page JSON: {error}")))?;

        let mut serialized_bytes = 0usize;

        for _ in 0..iterations {
            let result = crate::validator::validate_page_compiled(&page, &self.schema);

            let serialized = serde_json::to_string(&result).map_err(|error| {
                JsValue::from_str(&format!("Failed to serialize validation result: {error}"))
            })?;

            serialized_bytes += serialized.len();
        }

        Ok(serialized_bytes)
    }

    #[wasm_bindgen]
    pub fn validate_incremental(
        &self,
        page_json: &str,
        change_json: &str,
    ) -> Result<String, JsValue> {
        let page: PageNode = serde_json::from_str(page_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid page JSON: {error}")))?;

        let change = parse_change(change_json)?;

        let result = crate::incremental::validate_incremental(&page, &self.schema, &change);

        serialize_validation_result(&result)
    }

    #[wasm_bindgen]
    pub fn load_page(&self, page_json: &str) -> Result<PageHandle, JsValue> {
        let page: PageNode = serde_json::from_str(page_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid page JSON: {error}")))?;

        Ok(PageHandle { page })
    }

    #[wasm_bindgen]
    pub fn validate_resident(&self, page: &PageHandle) -> bool {
        crate::validator::validate_page_compiled(&page.page, &self.schema).valid
    }

    #[wasm_bindgen]
    pub fn validate_resident_many(&self, page: &PageHandle, iterations: u32) -> bool {
        let mut valid = true;

        for _ in 0..iterations {
            let result = crate::validator::validate_page_compiled(&page.page, &self.schema);

            valid &= result.valid;
        }

        valid
    }

    #[wasm_bindgen]
    pub fn validate_resident_incremental(
        &self,
        page: &PageHandle,
        change_json: &str,
    ) -> Result<String, JsValue> {
        let change = parse_change(change_json)?;

        let result = crate::incremental::validate_incremental(&page.page, &self.schema, &change);

        serialize_validation_result(&result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_field_changed() {
        let change: JsPageChange = serde_json::from_str(
            r#"{
                "type": "field_changed",
                "path": [0, 1, 2]
            }"#,
        )
        .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::field_changed(NodePath::from_indexes(vec![0, 1, 2]))
        );
    }

    #[test]
    fn converts_node_added() {
        let change: JsPageChange = serde_json::from_str(
            r#"{
                "type": "node_added",
                "path": [0, 2]
            }"#,
        )
        .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::node_added(NodePath::from_indexes(vec![0, 2]))
        );
    }

    #[test]
    fn converts_node_removed() {
        let change: JsPageChange = serde_json::from_str(
            r#"{
                "type": "node_removed",
                "path": [0, 3, 1]
            }"#,
        )
        .expect("failed to parse change");

        assert_eq!(
            change.into_page_change(),
            PageChange::node_removed(NodePath::from_indexes(vec![0, 3, 1]))
        );
    }

    #[test]
    fn converts_node_moved() {
        let change: JsPageChange = serde_json::from_str(
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
                NodePath::from_indexes(vec![0, 1]),
                NodePath::from_indexes(vec![0, 3])
            )
        );
    }

    #[test]
    fn rejects_unknown_change_type() {
        let result = serde_json::from_str::<JsPageChange>(
            r#"{
                "type": "unknown",
                "path": [0, 1]
            }"#,
        );

        assert!(result.is_err());
    }

    #[test]
    fn parses_field_change() {
        let result = parse_change(
            r#"{
                "type": "field_changed",
                "path": [0, 1, 2]
            }"#,
        );

        assert!(result.is_ok());

        assert_eq!(
            result.unwrap(),
            PageChange::field_changed(NodePath::from_indexes(vec![0, 1, 2]))
        );
    }

    #[test]
    fn rejects_invalid_change_json() {
        let result = parse_change(
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
            serialize_validation_result(&result).expect("failed to serialize validation result");

        assert_eq!(serialized, r#"{"valid":true,"errors":[]}"#);
    }
}
