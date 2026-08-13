use crate::{
    ChangeType,
    NodePath,
    PageChange,
};

pub fn affected_paths(
    change: &PageChange,
) -> Vec<NodePath> {
    match change.change_type {
        ChangeType::FieldChanged => {
            vec![
                change.path.clone(),
            ]
        }

        ChangeType::NodeAdded => {
            vec![
                change.path.clone(),
                change
                    .path
                    .parent()
                    .expect(
                        "added node must have a parent",
                    ),
            ]
        }

        ChangeType::NodeRemoved => {
            vec![
                change
                    .path
                    .parent()
                    .expect(
                        "removed node must have a parent",
                    ),
            ]
        }

        ChangeType::NodeMoved => {
            vec![
                change.path.clone(),
                change
                    .path
                    .parent()
                    .expect(
                        "moved node must have a parent",
                    ),
            ]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn field_change_affects_changed_node() {
        let change =
            PageChange::field_changed(
                NodePath::from_indexes(
                    vec![1, 1, 2],
                ),
            );

        let paths =
            affected_paths(
                &change,
            );

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(
                    vec![1, 1, 2],
                ),
            ],
        );
    }

    #[test]
    fn node_added_affects_node_and_parent() {
        let change =
            PageChange::node_added(
                NodePath::from_indexes(
                    vec![1, 1, 3],
                ),
            );

        let paths =
            affected_paths(
                &change,
            );

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(
                    vec![1, 1, 3],
                ),
                NodePath::from_indexes(
                    vec![1, 1],
                ),
            ],
        );
    }

    #[test]
    fn node_removed_affects_parent() {
        let change =
            PageChange::node_removed(
                NodePath::from_indexes(
                    vec![1, 1, 3],
                ),
            );

        let paths =
            affected_paths(
                &change,
            );

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(
                    vec![1, 1],
                ),
            ],
        );
    }

    #[test]
    fn node_moved_affects_node_and_parent() {
        let change =
            PageChange::node_moved(
                NodePath::from_indexes(
                    vec![1, 1, 3],
                ),
            );

        let paths =
            affected_paths(
                &change,
            );

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(
                    vec![1, 1, 3],
                ),
                NodePath::from_indexes(
                    vec![1, 1],
                ),
            ],
        );
    }
}