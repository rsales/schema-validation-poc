pub mod change;
pub mod change_resolver;
pub mod compiled;
pub mod incremental;
pub mod path;
pub mod scope;
pub mod types;
pub mod validator;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use change::PageChange;

pub use compiled::{
    CompiledComponentDefinition,
    CompiledFieldDefinition,
    CompiledSchema,
};

pub use change_resolver::affected_paths;

pub use path::NodePath;

pub use types::{
    ComponentDefinition,
    ComponentSchema,
    FieldDefinition,
    PageNode,
    ValidationError,
    ValidationResult,
};

pub use validator::{
    validate_at,
    validate_page,
    validate_page_compiled,
};

pub use scope::affected_scope;

#[cfg(target_arch = "wasm32")]
pub use wasm::PageValidator;