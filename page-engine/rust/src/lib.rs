pub mod types;
pub mod validator;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use types::{
    ComponentDefinition,
    ComponentSchema,
    FieldDefinition,
    PageNode,
};

pub use validator::validate_page;

#[cfg(target_arch = "wasm32")]
pub use wasm::validate_page as validate_page_wasm;