pub mod compiled;
pub mod types;
pub mod validator;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use compiled::{
    CompiledComponentDefinition,
    CompiledFieldDefinition,
    CompiledSchema,
};

pub use types::{
    ComponentDefinition,
    ComponentSchema,
    FieldDefinition,
    PageNode,
    ValidationError,
    ValidationResult,
};

pub use validator::{
    validate_page,
    validate_page_compiled,
};

#[cfg(target_arch = "wasm32")]
pub use wasm::PageValidator;