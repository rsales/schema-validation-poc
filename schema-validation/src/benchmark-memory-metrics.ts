export interface MemorySnapshot {
  rssMb: number
  heapUsedMb: number
  heapTotalMb: number
  externalMb: number
  arrayBuffersMb: number
}

export interface MemoryResult {
  name: string
  fixture: string
  iterations: number
  runs: number

  baseline: MemorySnapshot
  afterValidator: MemorySnapshot
  afterFixture: MemorySnapshot
  afterWarmup: MemorySnapshot
  peak: MemorySnapshot
  final: MemorySnapshot

  validatorDeltaMb: number
  fixtureDeltaMb: number
  warmupDeltaMb: number
  peakDeltaMb: number
}

export function getMemorySnapshot(): MemorySnapshot {
  const memory = process.memoryUsage()

  return {
    rssMb:
      memory.rss / 1024 / 1024,

    heapUsedMb:
      memory.heapUsed / 1024 / 1024,

    heapTotalMb:
      memory.heapTotal / 1024 / 1024,

    externalMb:
      memory.external / 1024 / 1024,

    arrayBuffersMb:
      memory.arrayBuffers / 1024 / 1024
  }
}

export function getPeakMemory(
  current: MemorySnapshot,
  previous: MemorySnapshot
): MemorySnapshot {
  return {
    rssMb: Math.max(
      current.rssMb,
      previous.rssMb
    ),

    heapUsedMb: Math.max(
      current.heapUsedMb,
      previous.heapUsedMb
    ),

    heapTotalMb: Math.max(
      current.heapTotalMb,
      previous.heapTotalMb
    ),

    externalMb: Math.max(
      current.externalMb,
      previous.externalMb
    ),

    arrayBuffersMb: Math.max(
      current.arrayBuffersMb,
      previous.arrayBuffersMb
    )
  }
}

export function formatMemoryResult(
  result: MemoryResult
) {
  return {
    Fixture: result.name,

    'Baseline RSS':
      `${result.baseline.rssMb.toFixed(2)} MB`,

    'Validator RSS':
      `${result.afterValidator.rssMb.toFixed(2)} MB`,

    'Fixture RSS':
      `${result.afterFixture.rssMb.toFixed(2)} MB`,

    'After Warmup':
      `${result.afterWarmup.rssMb.toFixed(2)} MB`,

    'Peak RSS':
      `${result.peak.rssMb.toFixed(2)} MB`,

    'Peak Heap':
      `${result.peak.heapUsedMb.toFixed(2)} MB`,

    'RSS Delta':
      `${result.peakDeltaMb.toFixed(2)} MB`,

    'Heap Delta':
      `${(
        result.peak.heapUsedMb -
        result.baseline.heapUsedMb
      ).toFixed(2)} MB`
  }
}

export function printMemoryLegend(): void {
  console.log()
  console.log('Memory Metrics')
  console.log('==============')
  console.log()

  console.log('Baseline RSS')
  console.log(
    '  Process memory before loading the validator.'
  )
  console.log()

  console.log('Validator RSS')
  console.log(
    '  Process memory after validator initialization.'
  )
  console.log()

  console.log('Fixture RSS')
  console.log(
    '  Process memory after fixture initialization.'
  )
  console.log()

  console.log('After Warmup')
  console.log(
    '  Process memory after warmup validations.'
  )
  console.log()

  console.log('Peak RSS')
  console.log(
    '  Highest process memory observed during the benchmark.'
  )
  console.log()

  console.log('Peak Heap')
  console.log(
    '  Highest JavaScript heap usage observed.'
  )
  console.log()

  console.log('RSS Delta')
  console.log(
    '  Peak RSS minus Baseline RSS.'
  )
  console.log()

  console.log('Heap Delta')
  console.log(
    '  Peak Heap Used minus Baseline Heap Used.'
  )
  console.log()

  console.log(
    'Note: RSS represents process-level memory usage and may include'
  )

  console.log(
    'runtime, allocator, native memory, and WASM memory.'
  )

  console.log()
}