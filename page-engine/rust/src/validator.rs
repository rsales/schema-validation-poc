use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;

use crate::compiled::{
    CompiledComponentDefinition,
    CompiledFieldDefinition,
    CompiledSchema,
};

use crate::types::{
    ComponentDefinition,
    ComponentSchema,
    FieldDefinition,
    PageNode,
    ValidationError,
    ValidationResult,
};

/*
 * --------------------------------------------------------------------------
 * Baseline validator
 * --------------------------------------------------------------------------
 */

pub fn validate_page(
    page: &PageNode,
    schema: &ComponentSchema,
) -> ValidationResult {
    let mut errors = Vec::new();

    validate_node(
        page,
        schema,
        "$",
        &mut errors,
    );

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}

fn validate_node(
    node: &PageNode,
    schema: &ComponentSchema,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let component =
        match schema.components.get(&node.node_type) {
            Some(component) => component,

            None => {
                errors.push(ValidationError {
                    path: format!("{path}.type"),
                    code: "UNKNOWN_COMPONENT".into(),
                    message: format!(
                        "Unknown component type \"{}\".",
                        node.node_type
                    ),
                });

                return;
            }
        };

    validate_fields(
        &node.fields,
        component,
        &format!("{path}.fields"),
        errors,
    );

    validate_children(
        &node.children,
        component,
        &format!("{path}.children"),
        errors,
    );

    for (index, child) in
        node.children.iter().enumerate()
    {
        validate_node(
            child,
            schema,
            &format!(
                "{path}.children[{index}]"
            ),
            errors,
        );
    }
}

fn validate_fields(
    fields: &HashMap<String, Value>,
    component: &ComponentDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    for (field_name, definition) in
        &component.fields
    {
        let field_path =
            format!("{path}.{field_name}");

        let value =
            fields.get(field_name);

        match value {
            None | Some(Value::Null) => {
                if definition
                    .required
                    .unwrap_or(false)
                {
                    errors.push(
                        ValidationError {
                            path: field_path,
                            code: "REQUIRED".into(),
                            message: format!(
                                "Field \"{field_name}\" \
                                 is required."
                            ),
                        },
                    );
                }

                continue;
            }

            Some(value) => {
                validate_field(
                    value,
                    field_name,
                    definition,
                    &field_path,
                    errors,
                );
            }
        }
    }

    for field_name in fields.keys() {
        if !component
            .fields
            .contains_key(field_name)
        {
            errors.push(
                ValidationError {
                    path: format!(
                        "{path}.{field_name}"
                    ),
                    code: "UNKNOWN_FIELD".into(),
                    message: format!(
                        "Unknown field \"{field_name}\"."
                    ),
                },
            );
        }
    }
}

fn validate_field(
    value: &Value,
    field_name: &str,
    definition: &FieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    match definition.field_type.as_str() {
        "string" => validate_string(
            value,
            field_name,
            definition,
            path,
            errors,
        ),

        "number" => validate_number(
            value,
            field_name,
            definition,
            path,
            errors,
        ),

        "enum" => validate_enum(
            value,
            field_name,
            definition,
            path,
            errors,
        ),

        _ => {}
    }
}

fn validate_string(
    value: &Value,
    field_name: &str,
    definition: &FieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let value = match value.as_str() {
        Some(value) => value,

        None => {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_TYPE".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be a string."
                    ),
                },
            );

            return;
        }
    };

    if let Some(min) =
        definition.min_length
    {
        if value.chars().count() < min {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MIN_LENGTH".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must have at least \
                         {min} characters."
                    ),
                },
            );
        }
    }

    if let Some(max) =
        definition.max_length
    {
        if value.chars().count() > max {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MAX_LENGTH".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must have at most \
                         {max} characters."
                    ),
                },
            );
        }
    }

    if let Some(pattern) =
        &definition.pattern
    {
        let regex =
            match Regex::new(pattern) {
                Ok(regex) => regex,
                Err(_) => return,
            };

        if !regex.is_match(value) {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "PATTERN".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         does not match the \
                         required pattern."
                    ),
                },
            );
        }
    }
}

fn validate_number(
    value: &Value,
    field_name: &str,
    definition: &FieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let value = match value.as_f64() {
        Some(value) => value,

        None => {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_TYPE".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be a number."
                    ),
                },
            );

            return;
        }
    };

    if let Some(minimum) =
        definition.minimum
    {
        if value < minimum {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MINIMUM".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be greater than \
                         or equal to {minimum}."
                    ),
                },
            );
        }
    }

    if let Some(maximum) =
        definition.maximum
    {
        if value > maximum {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MAXIMUM".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be less than \
                         or equal to {maximum}."
                    ),
                },
            );
        }
    }
}

fn validate_enum(
    value: &Value,
    field_name: &str,
    definition: &FieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let value = match value.as_str() {
        Some(value) => value,

        None => {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_TYPE".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be a string."
                    ),
                },
            );

            return;
        }
    };

    if let Some(values) =
        &definition.values
    {
        if !values
            .iter()
            .any(|allowed| allowed == value)
        {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_ENUM".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be one of: {}.",
                        values.join(", ")
                    ),
                },
            );
        }
    }
}

fn validate_children(
    children: &[PageNode],
    component: &ComponentDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    if children.len()
        < component.min_children
    {
        errors.push(
            ValidationError {
                path: path.into(),
                code: "MIN_CHILDREN".into(),
                message: format!(
                    "Component must have at least \
                     {} children.",
                    component.min_children
                ),
            },
        );
    }

    if children.len()
        > component.max_children
    {
        errors.push(
            ValidationError {
                path: path.into(),
                code: "MAX_CHILDREN".into(),
                message: format!(
                    "Component must have at most \
                     {} children.",
                    component.max_children
                ),
            },
        );
    }

    for (index, child) in
        children.iter().enumerate()
    {
        if !component
            .allowed_children
            .iter()
            .any(|allowed| {
                allowed == &child.node_type
            })
        {
            errors.push(
                ValidationError {
                    path: format!(
                        "{path}[{index}]"
                    ),
                    code: "CHILD_NOT_ALLOWED".into(),
                    message: format!(
                        "Child component \"{}\" \
                         is not allowed here.",
                        child.node_type
                    ),
                },
            );
        }
    }
}

/*
 * --------------------------------------------------------------------------
 * Compiled validator
 * --------------------------------------------------------------------------
 */

pub fn validate_page_compiled(
    page: &PageNode,
    schema: &CompiledSchema,
) -> ValidationResult {
    let mut errors = Vec::new();

    validate_compiled_node(
        page,
        schema,
        "$",
        &mut errors,
    );

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}

fn validate_compiled_node(
    node: &PageNode,
    schema: &CompiledSchema,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let component =
        match schema
            .components
            .get(&node.node_type)
        {
            Some(component) => component,

            None => {
                errors.push(
                    ValidationError {
                        path: format!(
                            "{path}.type"
                        ),
                        code:
                            "UNKNOWN_COMPONENT"
                                .into(),
                        message: format!(
                            "Unknown component type \
                             \"{}\".",
                            node.node_type
                        ),
                    },
                );

                return;
            }
        };

    validate_compiled_fields(
        &node.fields,
        component,
        &format!("{path}.fields"),
        errors,
    );

    validate_compiled_children(
        &node.children,
        component,
        &format!("{path}.children"),
        errors,
    );

    for (index, child) in
        node.children.iter().enumerate()
    {
        validate_compiled_node(
            child,
            schema,
            &format!(
                "{path}.children[{index}]"
            ),
            errors,
        );
    }
}

fn validate_compiled_fields(
    fields: &HashMap<String, Value>,
    component: &CompiledComponentDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    for (field_name, definition) in
        &component.fields
    {
        let field_path =
            format!("{path}.{field_name}");

        let value =
            fields.get(field_name);

        match value {
            None | Some(Value::Null) => {
                if definition.required {
                    errors.push(
                        ValidationError {
                            path: field_path,
                            code: "REQUIRED".into(),
                            message: format!(
                                "Field \"{field_name}\" \
                                 is required."
                            ),
                        },
                    );
                }

                continue;
            }

            Some(value) => {
                validate_compiled_field(
                    value,
                    field_name,
                    definition,
                    &field_path,
                    errors,
                );
            }
        }
    }

    for field_name in fields.keys() {
        if !component
            .fields
            .contains_key(field_name)
        {
            errors.push(
                ValidationError {
                    path: format!(
                        "{path}.{field_name}"
                    ),
                    code: "UNKNOWN_FIELD".into(),
                    message: format!(
                        "Unknown field \"{field_name}\"."
                    ),
                },
            );
        }
    }
}

fn validate_compiled_field(
    value: &Value,
    field_name: &str,
    definition: &CompiledFieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    match definition.field_type.as_str() {
        "string" => {
            validate_compiled_string(
                value,
                field_name,
                definition,
                path,
                errors,
            );
        }

        "number" => {
            validate_compiled_number(
                value,
                field_name,
                definition,
                path,
                errors,
            );
        }

        "enum" => {
            validate_compiled_enum(
                value,
                field_name,
                definition,
                path,
                errors,
            );
        }

        _ => {}
    }
}

fn validate_compiled_string(
    value: &Value,
    field_name: &str,
    definition: &CompiledFieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let value = match value.as_str() {
        Some(value) => value,

        None => {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_TYPE".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be a string."
                    ),
                },
            );

            return;
        }
    };

    if let Some(min) =
        definition.min_length
    {
        if value.chars().count() < min {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MIN_LENGTH".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must have at least \
                         {min} characters."
                    ),
                },
            );
        }
    }

    if let Some(max) =
        definition.max_length
    {
        if value.chars().count() > max {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MAX_LENGTH".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must have at most \
                         {max} characters."
                    ),
                },
            );
        }
    }

    if let Some(regex) =
        &definition.pattern
    {
        if !regex.is_match(value) {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "PATTERN".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         does not match the \
                         required pattern."
                    ),
                },
            );
        }
    }
}

fn validate_compiled_number(
    value: &Value,
    field_name: &str,
    definition: &CompiledFieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let value = match value.as_f64() {
        Some(value) => value,

        None => {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_TYPE".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be a number."
                    ),
                },
            );

            return;
        }
    };

    if let Some(minimum) =
        definition.minimum
    {
        if value < minimum {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MINIMUM".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be greater than \
                         or equal to {minimum}."
                    ),
                },
            );
        }
    }

    if let Some(maximum) =
        definition.maximum
    {
        if value > maximum {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "MAXIMUM".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be less than \
                         or equal to {maximum}."
                    ),
                },
            );
        }
    }
}

fn validate_compiled_enum(
    value: &Value,
    field_name: &str,
    definition: &CompiledFieldDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    let value = match value.as_str() {
        Some(value) => value,

        None => {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_TYPE".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be a string."
                    ),
                },
            );

            return;
        }
    };

    if let Some(values) =
        &definition.values
    {
        if !values
            .iter()
            .any(|allowed| allowed == value)
        {
            errors.push(
                ValidationError {
                    path: path.into(),
                    code: "INVALID_ENUM".into(),
                    message: format!(
                        "Field \"{field_name}\" \
                         must be one of: {}.",
                        values.join(", ")
                    ),
                },
            );
        }
    }
}

fn validate_compiled_children(
    children: &[PageNode],
    component: &CompiledComponentDefinition,
    path: &str,
    errors: &mut Vec<ValidationError>,
) {
    if children.len()
        < component.min_children
    {
        errors.push(
            ValidationError {
                path: path.into(),
                code: "MIN_CHILDREN".into(),
                message: format!(
                    "Component must have at least \
                     {} children.",
                    component.min_children
                ),
            },
        );
    }

    if children.len()
        > component.max_children
    {
        errors.push(
            ValidationError {
                path: path.into(),
                code: "MAX_CHILDREN".into(),
                message: format!(
                    "Component must have at most \
                     {} children.",
                    component.max_children
                ),
            },
        );
    }

    for (index, child) in
        children.iter().enumerate()
    {
        if !component
            .allowed_children
            .iter()
            .any(|allowed| {
                allowed == &child.node_type
            })
        {
            errors.push(
                ValidationError {
                    path: format!(
                        "{path}[{index}]"
                    ),
                    code: "CHILD_NOT_ALLOWED".into(),
                    message: format!(
                        "Child component \"{}\" \
                         is not allowed here.",
                        child.node_type
                    ),
                },
            );
        }
    }
}