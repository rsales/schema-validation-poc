.PHONY: rust-benchmark
.PHONY: rust-memory-benchmark
.PHONY: ajv-memory-worker
.PHONY: ajv-memory-benchmark
.PHONY: wasm-memory-worker
.PHONY: wasm-memory-benchmark

rust-benchmark:
	cd schema-validation && cargo run \
		--manifest-path rust/Cargo.toml \
		--release \
		--bin benchmark

rust-memory-benchmark:
	cd schema-validation && cargo run \
		--manifest-path rust/Cargo.toml \
		--release \
		--bin benchmark-memory

ajv-memory-worker:
	cd schema-validation && npx tsx src/benchmark-memory-worker.ts Small page-small.json 100 1

ajv-memory-benchmark:
	cd schema-validation && npx tsx src/benchmark-memory.ts

wasm-memory-worker:
	cd schema-validation && npx tsx src/benchmark-memory-wasm-worker.ts Small page-small.json 100 1

wasm-memory-benchmark:
	cd schema-validation && npx tsx src/benchmark-memory-wasm.ts

