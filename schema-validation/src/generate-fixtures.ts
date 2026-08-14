import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type BlockType = 'hero' | 'text' | 'image' | 'button'

interface PageBlock {
  id: string
  type: BlockType
  content: Record<string, unknown>
}

interface Page {
  id: string
  slug: string
  title: string
  blocks: PageBlock[]
}

const FIXTURES = [
  {
    name: 'page-medium.json',
    blocks: 50
  },
  {
    name: 'page-large.json',
    blocks: 500
  },
  {
    name: 'page-huge.json',
    blocks: 5000
  }
]

function createBlock(index: number): PageBlock {
  const types: BlockType[] = [
    'hero',
    'text',
    'image',
    'button'
  ]

  const type = types[index % types.length]

  switch (type) {
    case 'hero':
      return {
        id: `hero-${String(index + 1).padStart(4, '0')}`,
        type,
        content: {
          title: `Hero ${index + 1}`,
          description:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
        }
      }

    case 'text':
      return {
        id: `text-${String(index + 1).padStart(4, '0')}`,
        type,
        content: {
          text:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
            'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
        }
      }

    case 'image':
      return {
        id: `image-${String(index + 1).padStart(4, '0')}`,
        type,
        content: {
          src: `/images/image-${index + 1}.jpg`,
          alt: `Image ${index + 1}`
        }
      }

    case 'button':
      return {
        id: `button-${String(index + 1).padStart(4, '0')}`,
        type,
        content: {
          label: `Button ${index + 1}`,
          href: `/page-${index + 1}`
        }
      }
  }
}

function createPage(blockCount: number): Page {
  return {
    id: `page-${blockCount}`,
    slug: `/page-${blockCount}`,
    title: `Page with ${blockCount} blocks`,
    blocks: Array.from(
      { length: blockCount },
      (_, index) => createBlock(index)
    )
  }
}

async function main() {
  const fixturesDirectory = resolve('fixtures')

  await mkdir(fixturesDirectory, {
    recursive: true
  })

  for (const fixture of FIXTURES) {
    const page = createPage(fixture.blocks)

    const json = JSON.stringify(page, null, 2)

    const path = resolve(
      fixturesDirectory,
      fixture.name
    )

    await writeFile(path, `${json}\n`)

    const sizeKb = Buffer.byteLength(json) / 1024

    console.log(
      `${fixture.name}: ${fixture.blocks} blocks, ${sizeKb.toFixed(2)} KB`
    )
  }
}

main()