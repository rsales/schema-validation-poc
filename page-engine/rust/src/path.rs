use crate::types::PageNode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodePath {
    pub indexes: Vec<usize>,
}

impl NodePath {
    pub fn root() -> Self {
        Self {
            indexes: Vec::new(),
        }
    }

    pub fn from_indexes(indexes: Vec<usize>) -> Self {
        Self { indexes }
    }

    pub fn parent(&self) -> Option<Self> {
        if self.indexes.is_empty() {
            return None;
        }

        let mut indexes = self.indexes.clone();

        indexes.pop();

        Some(Self { indexes })
    }

    pub fn get<'a>(&self, root: &'a PageNode) -> Option<&'a PageNode> {
        let mut node = root;

        for &index in &self.indexes {
            node = node.children.get(index)?;
        }

        Some(node)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page() -> PageNode {
        serde_json::from_str(
            r#"
            {
                "id": "root",
                "type": "page",
                "fields": {},
                "children": [
                    {
                        "id": "hero",
                        "type": "hero",
                        "fields": {},
                        "children": []
                    },
                    {
                        "id": "grid",
                        "type": "grid",
                        "fields": {},
                        "children": [
                            {
                                "id": "card-1",
                                "type": "card",
                                "fields": {},
                                "children": []
                            },
                            {
                                "id": "card-2",
                                "type": "card",
                                "fields": {},
                                "children": []
                            }
                        ]
                    },
                    {
                        "id": "footer",
                        "type": "footer",
                        "fields": {},
                        "children": []
                    }
                ]
            }
            "#,
        )
        .expect("failed to parse test page")
    }

    #[test]
    fn resolves_root() {
        let page = page();

        let path = NodePath::root();

        let node = path.get(&page).expect("root should exist");

        assert_eq!(node.id, "root");
    }

    #[test]
    fn resolves_direct_child() {
        let page = page();

        let path = NodePath::from_indexes(vec![1]);

        let node = path.get(&page).expect("grid should exist");

        assert_eq!(node.id, "grid");
    }

    #[test]
    fn resolves_nested_child() {
        let page = page();

        let path = NodePath::from_indexes(vec![1, 1]);

        let node = path.get(&page).expect("card-2 should exist");

        assert_eq!(node.id, "card-2");
    }

    #[test]
    fn returns_none_for_invalid_path() {
        let page = page();

        let path = NodePath::from_indexes(vec![1, 99]);

        assert!(path.get(&page).is_none());
    }

    #[test]
    fn resolves_parent() {
        let path = NodePath::from_indexes(vec![1, 1]);

        let parent = path.parent().expect("parent should exist");

        assert_eq!(parent.indexes, vec![1]);
    }

    #[test]
    fn root_has_no_parent() {
        let path = NodePath::root();

        assert!(path.parent().is_none());
    }
}
