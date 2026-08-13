use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct FieldDefinition {
    #[serde(rename = "type")]
    pub field_type: String,

    pub required: Option<bool>,

    #[serde(rename = "minLength")]
    pub min_length: Option<usize>,

    #[serde(rename = "maxLength")]
    pub max_length: Option<usize>,

    pub pattern: Option<String>,

    pub minimum: Option<f64>,
    pub maximum: Option<f64>,

    pub values: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ComponentDefinition {
    pub fields: HashMap<String, FieldDefinition>,

    #[serde(rename = "allowedChildren")]
    pub allowed_children: Vec<String>,

    #[serde(rename = "minChildren")]
    pub min_children: usize,

    #[serde(rename = "maxChildren")]
    pub max_children: usize,
}

#[derive(Debug, Deserialize)]
pub struct ComponentSchema {
    pub components: HashMap<String, ComponentDefinition>,
}

#[derive(Debug, Deserialize)]
pub struct PageNode {
    pub id: String,

    #[serde(rename = "type")]
    pub node_type: String,

    pub fields: HashMap<String, serde_json::Value>,

    pub children: Vec<PageNode>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ValidationError {
    pub path: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
}