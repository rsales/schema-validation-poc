use crate::{
    affected_scope,
    validate_at,
    CompiledSchema,
    PageChange,
    PageNode,
    ValidationError,
    ValidationResult,
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

    let mut errors: Vec<ValidationError> =
        Vec::new();

    for path in &scope {
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

    use crate::{
        ComponentSchema,
        NodePath,
        PageChange,
    };

    use std::fs;

    fn load_schema() -> ComponentSchema {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../schema/component-schema.json"
        );

        let schema =
            fs::read_to_string(path)
                .expect("failed to read schema");

        serde_json::from_str(&schema)
            .expect("failed to parse schema")
    }

    fn load_page() -> PageNode {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../fixtures/page-small.json"
        );

        let page =
            fs::read_to_string(path)
                .expect("failed to read page");

        serde_json::from_str(&page)
            .expect("failed to parse page")
    }

    #[test]
    fn node_removed_detects_invalid_parent() {
        let schema =
            load_schema();

        let mut page =
            load_page();

        let compiled =
            CompiledSchema::compile(
                &schema,
            )
            .expect(
                "failed to compile schema",
            );

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

        page.children[0]
            .children
            .push(PageNode {
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
                children: vec![
                    PageNode {
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
                    },
                ],
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
            .expect(
                "grid should exist",
            )
            .children
            .remove(0);

        let change =
            PageChange::node_removed(
                NodePath::from_indexes(
                    vec![0, 3, 0],
                ),
            );

        let result =
            validate_incremental(
                &page,
                &compiled,
                &change,
            );

        assert!(
            !result.valid,
            "page should be invalid"
        );

        assert!(
            result.errors.iter().any(
                |error| {
                    error.code
                        == "MIN_CHILDREN"
                        && error.path
                            == "$.children[0].children[3].children"
                }
            ),
            "expected MIN_CHILDREN error, got: {:#?}",
            result.errors
        );
    }

		#[test]
		fn incremental_matches_full_validation() {
				let schema =
						load_schema();

				let mut page =
						load_page();

				let compiled =
						CompiledSchema::compile(
								&schema,
						)
						.expect(
								"failed to compile schema",
						);

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
				page.children[0]
						.children[0]
						.fields
						.insert(
								"text".into(),
								serde_json::Value::String(
										String::new(),
								),
						);

				let change =
						PageChange::field_changed(
								NodePath::from_indexes(
										vec![0, 0],
								),
						);

				/*
				* Full validation.
				*/
				let full =
						crate::validate_page_compiled(
								&page,
								&compiled,
						);

				/*
				* Incremental validation.
				*/
				let incremental =
						validate_incremental(
								&page,
								&compiled,
								&change,
						);

				assert!(
						!full.valid,
						"full validation should fail"
				);

				assert!(
						!incremental.valid,
						"incremental validation should fail"
				);

				/*
				* Both validations should report
				* the same validation error.
				*/
				assert_eq!(
						incremental.errors,
						full.errors,
				);
		}
}