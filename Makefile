.PHONY: rust-benchmark
.PHONY: rust-memory-benchmark

rust-benchmark:
	cargo run \
		--manifest-path rust/Cargo.toml \
		--release \
		--bin benchmark

rust-memory-benchmark:
	cargo run \
		--manifest-path rust/Cargo.toml \
		--release \
		--bin benchmark-memory