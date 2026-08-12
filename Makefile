.PHONY: rust-benchmark

rust-benchmark:
	cargo run \
		--manifest-path rust/Cargo.toml \
		--release \
		--bin benchmark