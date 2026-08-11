# Page Engine Fixtures

Fixtures represent realistic page documents used by the Page Engine validation benchmarks.

Unlike the original benchmark fixtures, these documents are designed specifically to exercise hierarchical component validation.

## Page Structure

A page is a tree:

```text
Page
├── Hero
│   ├── Heading
│   ├── Text
│   └── Button
│
└── Section
    └── Container
        ├── Heading
        ├── Text
        └── Grid
            ├── Card
            ├── Card
            └── Card
```

## Node Structure

Every node follows the same structure:

```
{
  "id":"button-1",
  "type":"button",
  "fields": {},
  "children": []
}
```

## Validation Complexity

The fixtures are expected to exercise:

- Deep component nesting
- Multiple component types
- Required fields
- String constraints
- Numeric constraints
- Enum validation
- Regex validation
- Allowed child validation
- Minimum child counts
- Maximum child counts

## Planned Fixtures

The Page Engine experiment will eventually include:

| Fixture | Purpose |
| --- | --- |
| `page-small.json` | Basic nested page |
| `page-medium.json` | Moderate component tree |
| `page-large.json` | Large component tree |
| `page-huge.json` | Stress workload |

The exact fixture sizes should be generated rather than manually maintained when the benchmark infrastructure is implemented.