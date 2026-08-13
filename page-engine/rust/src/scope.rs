use crate::{
    ChangeType,
    ComponentSchema,
    NodePath,
    PageChange,
    PageNode,
};

pub fn affected_scope(
    page: &PageNode,
    schema: &ComponentSchema,
    change: &PageChange,
) -> Vec<NodePath> {
    match change.change_type {
        ChangeType::FieldChanged => {
            vec![
                change.path.clone(),
            ]
        }

        ChangeType::NodeAdded => {
            let Some(parent) =
                change.path.parent()
            else {
                return Vec::new();
            };

            let mut paths = vec![
                change.path.clone(),
            ];

            paths.extend(
                structural_scope(
                    page,
                    schema,
                    vec![parent],
                ),
            );

            paths
        }

        ChangeType::NodeRemoved => {
            let Some(parent) =
                change.path.parent()
            else {
                return Vec::new();
            };

            structural_scope(
                page,
                schema,
                vec![parent],
            )
        }

        ChangeType::NodeMoved => {
            structural_scope(
                page,
                schema,
                vec![
                    change.path.clone(),
                ],
            )
        }
    }
}

fn parent_has_structural_rules(
    page: &PageNode,
    schema: &ComponentSchema,
    path: &NodePath,
) -> bool {
    let Some(node) =
        path.get(page)
    else {
        return false;
    };

    let Some(component) =
        schema.components.get(&node.node_type)
    else {
        return false;
    };

    !component.allowed_children.is_empty()
        || component.min_children > 0
        || component.max_children > 0
}

fn structural_ancestors(
    page: &PageNode,
    schema: &ComponentSchema,
    path: &NodePath,
) -> Vec<NodePath> {
    if path.get(page).is_none() {
        return Vec::new();
    }

    let mut ancestors = Vec::new();

    let mut current =
        path.parent();

    while let Some(parent) = current {
        if parent_has_structural_rules(
            page,
            schema,
            &parent,
        ) {
            ancestors.push(
                parent.clone(),
            );
        }

        current =
            parent.parent();
    }

    ancestors
}

fn structural_scope(
    page: &PageNode,
    schema: &ComponentSchema,
    paths: Vec<NodePath>,
) -> Vec<NodePath> {
    let mut result = Vec::new();

    for path in paths {
        if !result.contains(&path) {
            result.push(path.clone());
        }

        for ancestor in structural_ancestors(
            page,
            schema,
            &path,
        ) {
            if !result.contains(&ancestor) {
                result.push(ancestor);
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn field_change_affects_only_node() {
        let page = page();
        let schema = schema();

        let change =
            PageChange::field_changed(
                NodePath::from_indexes(
                    vec![0, 0, 0],
                ),
            );

        let paths =
            affected_scope(
                &page,
                &schema,
                &change,
            );

        assert_eq!(
            paths,
            vec![
                NodePath::from_indexes(
                    vec![0, 0, 0],
                ),
            ],
        );
    }

		#[test]
		fn node_added_affects_structural_ancestors() {
				let page = page();
				let schema = schema();

				let change =
						PageChange::node_added(
								NodePath::from_indexes(
										vec![0, 0, 1],
								),
						);

				let paths =
						affected_scope(
								&page,
								&schema,
								&change,
						);

				assert_eq!(
						paths,
						vec![
								NodePath::from_indexes(
										vec![0, 0, 1],
								),
								NodePath::from_indexes(
										vec![0, 0],
								),
								NodePath::from_indexes(
										vec![0],
								),
								NodePath::from_indexes(
										vec![],
								),
						],
				);
		}

    #[test]
    fn node_removed_affects_structural_parent() {
        let page = page();
        let schema = schema();

        let change =
            PageChange::node_removed(
                NodePath::from_indexes(
                    vec![0, 0, 0],
                ),
            );

        let paths =
            affected_scope(
                &page,
                &schema,
                &change,
            );

        assert_eq!(
						paths,
						vec![
								NodePath::from_indexes(
										vec![0, 0],
								),
								NodePath::from_indexes(
										vec![0],
								),
								NodePath::from_indexes(
										vec![],
								),
						],
				);
    }

    #[test]
    fn node_moved_affects_structural_parent() {
        let page = page();
        let schema = schema();

        let change =
            PageChange::node_moved(
                NodePath::from_indexes(
                    vec![0, 0, 0],
                ),
            );

        let paths =
            affected_scope(
                &page,
                &schema,
                &change,
            );

        assert_eq!(
						paths,
						vec![
								NodePath::from_indexes(
										vec![0, 0, 0],
								),
								NodePath::from_indexes(
										vec![0, 0],
								),
								NodePath::from_indexes(
										vec![0],
								),
								NodePath::from_indexes(
										vec![],
								),
						],
				);
    }

		#[test]
		fn structural_ancestors_resolves_full_chain() {
				let page = page();
				let schema = schema();

				let path =
						NodePath::from_indexes(
								vec![0, 0, 0],
						);

				let ancestors =
						structural_ancestors(
								&page,
								&schema,
								&path,
						);

				assert_eq!(
						ancestors,
						vec![
								NodePath::from_indexes(
										vec![0, 0],
								),
								NodePath::from_indexes(
										vec![0],
								),
								NodePath::from_indexes(
										vec![],
								),
						],
				);
		}

		#[test]
		fn structural_ancestors_stops_at_root() {
				let page = page();
				let schema = schema();

				let path =
						NodePath::from_indexes(
								vec![],
						);

				let ancestors =
						structural_ancestors(
								&page,
								&schema,
								&path,
						);

				assert!(
						ancestors.is_empty()
				);
		}

		#[test]
		fn structural_ancestors_returns_empty_for_invalid_path() {
				let page = page();
				let schema = schema();

				let path =
						NodePath::from_indexes(
								vec![99, 99],
						);

				let ancestors =
						structural_ancestors(
								&page,
								&schema,
								&path,
						);

				assert!(
						ancestors.is_empty()
				);
		}

		#[test]
		fn structural_ancestors_skips_non_structural_ancestors() {
				let page: PageNode =
						serde_json::from_str(
								r#"
								{
										"id": "root",
										"type": "heading",
										"fields": {
												"text": "Root",
												"level": 1
										},
										"children": []
								}
								"#,
						)
						.expect("failed to parse test page");

				let schema = schema();

				let path =
						NodePath::from_indexes(
								vec![0],
						);

				let ancestors =
						structural_ancestors(
								&page,
								&schema,
								&path,
						);

				assert!(
						ancestors.is_empty()
				);
		}
}

