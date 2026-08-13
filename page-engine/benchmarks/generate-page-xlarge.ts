import { writeFileSync } from 'node:fs'

type Node = {
  id: string
  type: string
  fields: Record<string, unknown>
  children: Node[]
}

function heading(
  id: string,
  text: string,
): Node {
  return {
    id,
    type: 'heading',
    fields: {
      text,
      level: 3,
    },
    children: [],
  }
}

function text(
  id: string,
  content: string,
): Node {
  return {
    id,
    type: 'text',
    fields: {
      content,
    },
    children: [],
  }
}

function card(
  index: number,
): Node {
  return {
    id: `card-${index}`,
    type: 'card',
    fields: {
      title: `Product ${index}`,
    },
    children: [
      heading(
        `card-heading-${index}`,
        `Product ${index}`,
      ),
      text(
        `card-text-${index}`,
        `Description for product ${index}.`,
      ),
    ],
  }
}

function section(
  sectionIndex: number,
): Node {
  const cards: Node[] = []

  for (
    let i = 0;
    i < 12;
    i++
  ) {
    cards.push(
      card(
        sectionIndex * 12 + i,
      ),
    )
  }

  return {
    id: `section-${sectionIndex}`,
    type: 'section',
    fields: {
      id: `section-${sectionIndex}`,
    },
    children: [
      {
        id: `grid-${sectionIndex}`,
        type: 'grid',
        fields: {
          columns: 4,
          gap: 24,
        },
        children: cards,
      },
    ],
  }
}

const sections: Node[] = []

for (
  let i = 0;
  i < 20;
  i++
) {
  sections.push(
    section(i),
  )
}

const page: Node = {
  id: 'home',
  type: 'page',
  fields: {},
  children: sections,
}

writeFileSync(
  'page-engine/fixtures/page-xlarge.json',
  JSON.stringify(
    page,
    null,
    2,
  ) + '\n',
)

let count = 0

function countNodes(
  node: Node,
): void {
  count++

  for (
    const child of node.children
  ) {
    countNodes(child)
  }
}

countNodes(page)

console.log(
  `Generated ${count} nodes.`,
)