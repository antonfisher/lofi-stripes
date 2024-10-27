# Build

.PHONY: build_rust_release
build_rust_release:
	@echo "Building rust [release]..."
	wasm-pack build --target web --release --out-dir pkg src/wasm

.PHONY: build_rust_debug
build_rust_debug:
	@echo "Building rust [debug]..."
	wasm-pack build --target web --debug --out-dir pkg src/wasm

.PHONY: build_ts
build_ts:
	@echo "Building typescript..."
	tsc

.PHONY: move_to_docs
move_to_docs:
	@echo "Moving to docs..."
	mkdir -p ./docs/wasm/pkg
	cp -r ./src/wasm/pkg/* ./docs/wasm/pkg/

# Clean up

.PHONY: clean_target
clean_target:
	@echo "Cleaning target..."
	rm -rf ./src/wasm/target

.PHONY: clean_docs
clean_docs:
	@echo "Cleaning docs..."
	rm -rf ./src/wasm/pkg
	rm -rf ./docs/wasm

# Development

.PHONY: watch_ts
watch_ts:
	@echo "Building/watching typescript..."
	tsc --watch

.PHONY: serve
serve:
	@echo "Running server..."
	python3 dev_server.py

.PHONY: run_debug
run_debug: clean_docs build_debug build_ts move_to_docs serve
	@echo "Building and running debug..."

.PHONY: clean_and_run_debug
clean_and_run_debug: clean_target clean_docs build_debug build_ts move_to_docs serve
	@echo "Clean, build and run debug..."

.PHONY: run_release
run_release: clean_docs build_release build_ts move_to_docs serve
	@echo "Building and running release..."

.PHONY: clean_and_run_release
clean_and_run_release: clean_target clean_docs build_release build_ts move_to_docs serve
	@echo "Clean, build and run release..."

# Release

.PHONY: build_release
build_release: clean_target clean_docs build_rust_release build_ts move_to_docs
