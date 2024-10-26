# lofi-stripes

[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

A web application for creating lofi t-shirt prints.
Built with js, wasm and rust.

## Example

![photo that shows a t-shirt with a print from the app](./docs/data/demo.jpg)

## Development

```bash
# run localy:
make run_release
make run_debug

# clear all build artifacts and run localy:
make clean_and_run_release
make clean_and_run_debug

# watch typescript changes (useful to run in parallel):
make watch_ts
```

See [Makefile](./Makefile) for more commands.

## Deploy

```bash
# build:
make build_release

# git commit ...
```

## License

[MIT License](./LICENSE)
