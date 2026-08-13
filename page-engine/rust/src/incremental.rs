#[cfg(test)]
mod tests {
    use crate::{
        affected_scope,
        validate_at,
        CompiledSchema,
        ComponentSchema,
        NodePath,
        PageChange,
        PageNode,
    };

    fn page() -> PageNode {
        serde_json::from_str(
            r#"
            {
                "id": "home",
                "type": "page",
                "fields": {},
                "children": [
                    {
                        "id": "section",
                        "type": "section",
                        "fields": {
                            "id": "section"
                        },
                        "children": [
                            {
                                "id": "grid",
                                "type": "grid",
                                "fields": {
                                    "columns": 4
                                },
                                "children": [
                                    {
                                        "id": "card",
                                        "type": "card",
                                        "fields": {
                                            "title": "Product"
                                        },
                                        "children": []
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
            "#,
        )
        .expect("failed to parse test page")
    }

    fn schema() -> ComponentSchema {
        serde_json::from_str(
            r#"
            {
                "components": {
                    "page": {
                        "fields": {},
                        "allowedChildren": [
                            "section"
                        ],
                        "minChildren": 1,
                        "maxChildren": 20
                    },
                    "section": {
                        "fields": {
                            "id": {
                                "type": "string",
                                "required": true
                            }
                        },
                        "allowedChildren": [
                            "grid"
                        ],
                        "minChildren": 1,
                        "maxChildren": 4
                    },
                    "grid": {
                        "fields": {
                            "columns": {
                                "type": "number",
                                "required": true,
                                "minimum": 1,
                                "maximum": 12
                            }
                        },
                        "allowedChildren": [
                            "card"
                        ],
                        "minChildren": 1,
                        "maxChildren": 12
                    },
                    "card": {
                        "fields": {
                            "title": {
                                "type": "string",
                                "required": true
                            }
                        },
                        "allowedChildren": [],
                        "minChildren": 0,
                        "maxChildren": 0
                    }
                }
            }
            "#,
        )
        .expect("failed to parse test schema")
    }

    #[test]
    fn node_removed_detects_invalid_parent() {
        let schema = schema();
        let mut page = page();

        let compiled =
            CompiledSchema::compile(&schema)
                .expect("failed to compile schema");

        page.children[0]
            .children[0]
            .children
            .remove(0);

        let change =
            PageChange::node_removed(
                NodePath::from_indexes(
                    vec![0, 0, 0],
                ),
            );

        let scope =
            affected_scope(
                &page,
                &schema,
                &change,
            );

        assert_eq!(
            scope,
            vec![
                NodePath::from_indexes(
                    vec![0, 0],
                ),
                NodePath::from_indexes(
                    vec![0],
                ),
                NodePath::root(),
            ],
        );

        let mut errors = Vec::new();

        for path in &scope {
            let result =
                validate_at(
                    &page,
                    &compiled,
                    path,
                );

            errors.extend(
                result.errors,
            );
        }

        assert!(
            errors.iter().any(|error| {
                error.code == "MIN_CHILDREN"
                    && error.path
                        == "$.children[0].children[0].children"
            }),
            "expected MIN_CHILDREN error, got: {errors:#?}"
        );
    }
}