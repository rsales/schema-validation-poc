use crate::{
    CompiledSchema, NodePath, PageChange, PageNode, ValidationError, ValidationResult, affected_scope,
    validate_at,
};

pub fn validate_incremental(
    page: &PageNode,
    schema: &CompiledSchema,
    change: &PageChange,
) -> ValidationResult {
    let scope =
        affected_scope(
            page,
            schema,
            change,
        );

    validate_incremental_scope(
        page,
        schema,
        &scope,
    )
}

pub fn validate_incremental_scope(
    page: &PageNode,
    schema: &CompiledSchema,
    scope: &[NodePath],
) -> ValidationResult {
    let mut errors:
        Vec<ValidationError> =
        Vec::new();

    for path in scope {
        let result =
            validate_at(
                page,
                schema,
                path,
            );

        errors.extend(
            result.errors,
        );
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::{ComponentSchema, NodePath, PageChange};

    use std::fs;

    fn load_schema() -> ComponentSchema {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../schema/component-schema.json"
        );

        let schema = fs::read_to_string(path).expect("failed to read schema");

        serde_json::from_str(&schema).expect("failed to parse schema")
    }

    fn load_page() -> PageNode {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/page-small.json");

        let page = fs::read_to_string(path).expect("failed to read page");

        serde_json::from_str(&page).expect("failed to parse page")
    }

    /// Resolve a mutable node from a NodePath.
    ///
    /// NodePath currently exposes its indexes directly,
    /// but does not expose a mutable `get_mut` helper.
    fn get_node_mut<'a>(page: &'a mut PageNode, path: &NodePath) -> &'a mut PageNode {
        let mut current = page;

        for &index in &path.indexes {
            current = current.children.get_mut(index).expect("invalid node path");
        }

        current
    }

    /// Resolve the mutable parent of a node.
    fn get_parent_mut<'a>(page: &'a mut PageNode, path: &NodePath) -> &'a mut PageNode {
        assert!(!path.indexes.is_empty(), "root node does not have a parent");

        let mut current = page;

        for &index in &path.indexes[..path.indexes.len() - 1] {
            current = current
                .children
                .get_mut(index)
                .expect("invalid parent path");
        }

        current
    }

    #[test]
    fn node_removed_detects_invalid_parent() {
        let schema = load_schema();

        let mut page = load_page();

        let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

        /*
         * page-small does not contain a
         * grid/card tree, so build the
         * structural scenario explicitly.
         *
         * Before:
         *
         * page
         * └── section
         *     └── grid
         *         └── card
         *
         * After:
         *
         * page
         * └── section
         *     └── grid
         *
         * The grid requires at least
         * one child.
         */

        page.children[0].children.push(PageNode {
            id: "grid-1".into(),
            node_type: "grid".into(),
            fields: serde_json::json!({
                "columns": 4,
                "gap": 24
            })
            .as_object()
            .unwrap()
            .clone()
            .into_iter()
            .collect(),
            children: vec![PageNode {
                id: "card-1".into(),
                node_type: "card".into(),
                fields: serde_json::json!({
                    "title": "Product One"
                })
                .as_object()
                .unwrap()
                .clone()
                .into_iter()
                .collect(),
                children: vec![],
            }],
        });

        /*
         * Remove the card.
         *
         * Removed node:
         *
         * $.children[0]
         *   .children[3]
         *   .children[0]
         *
         * Parent:
         *
         * $.children[0]
         *   .children[3]
         */

        page.children[0]
            .children
            .get_mut(3)
            .expect("grid should exist")
            .children
            .remove(0);

        let change = PageChange::node_removed(NodePath::from_indexes(vec![0, 3, 0]));

        let result = validate_incremental(&page, &compiled, &change);

        assert!(!result.valid, "page should be invalid");

        assert!(
            result.errors.iter().any(|error| {
                error.code == "MIN_CHILDREN" && error.path == "$.children[0].children[3].children"
            }),
            "expected MIN_CHILDREN error, got: {:#?}",
            result.errors
        );
    }

    #[test]
    fn incremental_matches_full_validation() {
        let schema = load_schema();

        let mut page = load_page();

        let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

        /*
         * Make the heading invalid.
         *
         * Original:
         *
         * $.children[0]
         *   .children[0]
         *   .fields.text
         *
         * The heading's `text` field has
         * minLength = 1.
         */

        let heading_path = NodePath::from_indexes(vec![0, 0]);

        get_node_mut(&mut page, &heading_path)
            .fields
            .insert("text".into(), serde_json::Value::String(String::new()));

        let change = PageChange::field_changed(heading_path);

        /*
         * Full validation.
         */

        let full = crate::validate_page_compiled(&page, &compiled);

        /*
         * Incremental validation.
         */

        let incremental = validate_incremental(&page, &compiled, &change);

        assert!(!full.valid, "full validation should fail");

        assert!(!incremental.valid, "incremental validation should fail");

        /*
         * Both validations should report
         * the same validation error.
         */

        assert_eq!(incremental.errors, full.errors);
    }

    #[test]
    fn node_added_incremental_matches_full_validation() {
        let schema = load_schema();

        let mut page = load_page();

        let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

        /*
         * Add a node to a structural parent.
         *
         * page
         * └── section
         *     └── heading
         *     └── new heading
         *
         * The page represents the state AFTER
         * the node was added.
         */

        let new_path = NodePath::from_indexes(vec![0, 2]);

        let new_heading = PageNode {
            id: "benchmark-heading".into(),
            node_type: "heading".into(),
            fields: serde_json::json!({
                "text": "New heading",
                "level": 2
            })
            .as_object()
            .unwrap()
            .clone()
            .into_iter()
            .collect(),
            children: vec![],
        };

        let parent = get_parent_mut(&mut page, &new_path);

        parent.children.insert(2, new_heading);

        let change = PageChange::node_added(new_path);

        /*
         * Full validation.
         */

        let full = crate::validate_page_compiled(&page, &compiled);

        /*
         * Incremental validation.
         */

        let incremental = validate_incremental(&page, &compiled, &change);

        assert_eq!(
            incremental.valid, full.valid,
            "incremental and full validation should agree on validity"
        );

        assert_eq!(
            incremental.errors, full.errors,
            "incremental and full validation should report the same errors"
        );
    }

    #[test]
    fn node_removed_incremental_matches_full_validation() {
        let schema = load_schema();

        let mut page = load_page();

        let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

        /*
         * Remove an existing heading.
         *
         * The page represents the state AFTER
         * the node was removed.
         */

        let removed_path = NodePath::from_indexes(vec![0, 0]);

        let parent = get_parent_mut(&mut page, &removed_path);

        parent.children.remove(0);

        let change = PageChange::node_removed(removed_path);

        /*
         * Full validation.
         */

        let full = crate::validate_page_compiled(&page, &compiled);

        /*
         * Incremental validation.
         */

        let incremental = validate_incremental(&page, &compiled, &change);

        assert_eq!(
            incremental.valid, full.valid,
            "incremental and full validation should agree on validity"
        );

        assert_eq!(
            incremental.errors, full.errors,
            "incremental and full validation should report the same errors"
        );
    }

    #[test]
    fn node_moved_incremental_matches_full_validation() {
        let schema = load_schema();

        let mut page = load_page();

        let compiled = CompiledSchema::compile(&schema).expect("failed to compile schema");

        /*
         * Move an existing node inside the same parent.
         *
         * Before:
         *
         * section
         * ├── heading A
         * └── heading B
         *
         * After:
         *
         * section
         * ├── heading B
         * └── heading A
         */

        let from = NodePath::from_indexes(vec![0, 0]);

        let to = NodePath::from_indexes(vec![0, 1]);

        let from_index = *from.indexes.last().expect("from path should not be empty");

        let to_index = *to.indexes.last().expect("to path should not be empty");

        let parent = get_parent_mut(&mut page, &from);

        let moved_node = parent.children.remove(from_index);

        parent.children.insert(to_index, moved_node);

        let change = PageChange::node_moved(from, to);

        /*
         * Full validation.
         */

        let full = crate::validate_page_compiled(&page, &compiled);

        /*
         * Incremental validation.
         */

        let incremental = validate_incremental(&page, &compiled, &change);

        assert_eq!(
            incremental.valid, full.valid,
            "incremental and full validation should agree on validity"
        );

        assert_eq!(
            incremental.errors, full.errors,
            "incremental and full validation should report the same errors"
        );
    }
}
