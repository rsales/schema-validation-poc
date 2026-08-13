use regex::Regex;
use std::collections::HashMap;

use crate::types::{
    ComponentSchema,
    FieldDefinition,
};

pub struct CompiledFieldDefinition {
    pub field_type: String,
    pub required: bool,

    pub min_length: Option<usize>,
    pub max_length: Option<usize>,

    pub pattern: Option<Regex>,

    pub minimum: Option<f64>,
    pub maximum: Option<f64>,

    pub values: Option<Vec<String>>,
}

pub struct CompiledComponentDefinition {
    pub fields:
        HashMap<String, CompiledFieldDefinition>,

    pub allowed_children: Vec<String>,

    pub min_children: usize,
    pub max_children: usize,
}

pub struct CompiledSchema {
    pub components:
        HashMap<String, CompiledComponentDefinition>,
}

impl CompiledSchema {
    pub fn compile(
        schema: &ComponentSchema,
    ) -> Result<Self, String> {
        let mut components = HashMap::new();

        for (name, component) in &schema.components {
            let mut fields = HashMap::new();

            for (field_name, definition) in &component.fields {
                let field =
                    compile_field(
                        definition,
                        name,
                        field_name,
                    )?;

                fields.insert(
                    field_name.clone(),
                    field,
                );
            }

            components.insert(
                name.clone(),
                CompiledComponentDefinition {
                    fields,
                    allowed_children:
                        component
                            .allowed_children
                            .clone(),
                    min_children:
                        component.min_children,
                    max_children:
                        component.max_children,
                },
            );
        }

        Ok(Self {
            components,
        })
    }
}

fn compile_field(
    definition: &FieldDefinition,
    component_name: &str,
    field_name: &str,
) -> Result<
    CompiledFieldDefinition,
    String,
> {
    let pattern =
        match &definition.pattern {
            Some(pattern) => {
                Some(
                    Regex::new(pattern)
                        .map_err(|error| {
                            format!(
                                "Invalid regex for component \
                                 \"{component_name}\", field \
                                 \"{field_name}\": {error}"
                            )
                        })?,
                )
            }

            None => None,
        };

    Ok(
        CompiledFieldDefinition {
            field_type:
                definition.field_type.clone(),

            required:
                definition.required
                    .unwrap_or(false),

            min_length:
                definition.min_length,

            max_length:
                definition.max_length,

            pattern,

            minimum:
                definition.minimum,

            maximum:
                definition.maximum,

            values:
                definition.values.clone(),
        },
    )
}