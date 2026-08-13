use crate::path::NodePath;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PageChange {
    FieldChanged {
        path: NodePath,
    },

    NodeAdded {
        path: NodePath,
    },

    NodeRemoved {
        path: NodePath,
    },

    NodeMoved {
        from: NodePath,
        to: NodePath,
    },
}

impl PageChange {
    pub fn field_changed(
        path: NodePath,
    ) -> Self {
        Self::FieldChanged {
            path,
        }
    }

    pub fn node_added(
        path: NodePath,
    ) -> Self {
        Self::NodeAdded {
            path,
        }
    }

    pub fn node_removed(
        path: NodePath,
    ) -> Self {
        Self::NodeRemoved {
            path,
        }
    }

    pub fn node_moved(
        from: NodePath,
        to: NodePath,
    ) -> Self {
        Self::NodeMoved {
            from,
            to,
        }
    }
}