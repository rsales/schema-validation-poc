use std::cell::RefCell;

use jsonschema::Validator;
use serde_json::Value;
use wasm_bindgen::prelude::*;

thread_local! {
    static VALIDATOR: RefCell<Option<Validator>> =
        const { RefCell::new(None) };

    static PAGE: RefCell<Option<Value>> =
        const { RefCell::new(None) };
}

#[wasm_bindgen]
pub fn init_validator(schema_json: &str) -> Result<(), JsValue> {
    let schema: Value = serde_json::from_str(schema_json)
        .map_err(|error| {
            JsValue::from_str(
                &format!("Invalid JSON Schema: {error}")
            )
        })?;

    let validator =
        jsonschema::validator_for(&schema)
            .map_err(|error| {
                JsValue::from_str(
                    &format!("Invalid JSON Schema: {error}")
                )
            })?;

    VALIDATOR.with(|cell| {
        *cell.borrow_mut() = Some(validator);
    });

    Ok(())
}

#[wasm_bindgen]
pub fn init_page(page_json: &str) -> Result<(), JsValue> {
    let page: Value =
        serde_json::from_str(page_json)
            .map_err(|error| {
                JsValue::from_str(
                    &format!("Invalid page JSON: {error}")
                )
            })?;

    PAGE.with(|cell| {
        *cell.borrow_mut() = Some(page);
    });

    Ok(())
}

#[wasm_bindgen]
pub fn validate_cached() -> bool {
    VALIDATOR.with(|validator_cell| {
        PAGE.with(|page_cell| {
            let validator = validator_cell.borrow();
            let page = page_cell.borrow();

            let Some(validator) = validator.as_ref() else {
                return false;
            };

            let Some(page) = page.as_ref() else {
                return false;
            };

            validator.is_valid(page)
        })
    })
}

#[wasm_bindgen]
pub fn validate_page(page_json: &str) -> bool {
    VALIDATOR.with(|cell| {
        let validator = cell.borrow();

        let Some(validator) = validator.as_ref() else {
            return false;
        };

        let page: Value =
            match serde_json::from_str(page_json) {
                Ok(value) => value,
                Err(_) => return false,
            };

        validator.is_valid(&page)
    })
}