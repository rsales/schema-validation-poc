use crate::{NodePath, PageChange};

pub fn affected_paths(change: &PageChange) -> Vec<NodePath> {
    match change {
        PageChange::FieldChanged { path } => {
            vec![path.clone()]
        }

        PageChange::NodeAdded { path } => {
            let mut paths = vec![path.clone()];

            if let Some(parent) = path.parent() {
                paths.push(parent);
            }

            paths
        }

        PageChange::NodeRemoved { path } => {
            let mut paths = Vec::new();

            if let Some(parent) = path.parent() {
                paths.push(parent);
            }

            paths
        }

        PageChange::NodeMoved { from, to } => {
            let mut paths = vec![from.clone(), to.clone()];

            if let Some(parent) = from.parent() {
                paths.push(parent);
            }

            if let Some(parent) = to.parent() {
                paths.push(parent);
            }

            paths
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn field_change_affects_changed_node() {
        let change = PageChange::field_changed(NodePath::from_indexes(vec![1, 1, 2]));

        let paths = affected_paths(&change);

        assert_eq!(paths, vec![NodePath::from_indexes(vec![1, 1, 2],),],);
    }

    #[test]
    fn node_added_affects_node_and_parent() {
        let change = PageChange::node_added(NodePath::from_indexes(vec![1, 1, 3]));

        let paths = affected_paths(&change);

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(vec![1, 1, 3],),
                NodePath::from_indexes(vec![1, 1],),
            ],
        );
    }

    #[test]
    fn node_removed_affects_parent() {
        let change = PageChange::node_removed(NodePath::from_indexes(vec![1, 1, 3]));

        let paths = affected_paths(&change);

        assert_eq!(paths, vec![NodePath::from_indexes(vec![1, 1],),],);
    }

    #[test]
    fn node_moved_affects_old_and_new_locations() {
        let change = PageChange::node_moved(
            NodePath::from_indexes(vec![1, 1, 3]),
            NodePath::from_indexes(vec![2, 0, 1]),
        );

        let paths = affected_paths(&change);

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(vec![1, 1, 3],),
                NodePath::from_indexes(vec![2, 0, 1],),
                NodePath::from_indexes(vec![1, 1],),
                NodePath::from_indexes(vec![2, 0],),
            ],
        );
    }
}
