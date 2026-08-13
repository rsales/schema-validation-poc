use crate::path::NodePath;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeType {
    FieldChanged,
    NodeAdded,
    NodeRemoved,
    NodeMoved,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageChange {
    pub path: NodePath,
    pub change_type: ChangeType,
}

impl PageChange {
    pub fn field_changed(
        path: NodePath,
    ) -> Self {
        Self {
            path,
            change_type:
                ChangeType::FieldChanged,
        }
    }

    pub fn node_added(
        path: NodePath,
    ) -> Self {
        Self {
            path,
            change_type:
                ChangeType::NodeAdded,
        }
    }

    pub fn node_removed(
        path: NodePath,
    ) -> Self {
        Self {
            path,
            change_type:
                ChangeType::NodeRemoved,
        }
    }

    pub fn node_moved(
        path: NodePath,
    ) -> Self {
        Self {
            path,
            change_type:
                ChangeType::NodeMoved,
        }
    }
}