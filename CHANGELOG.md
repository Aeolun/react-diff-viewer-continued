## [4.0.5](https://github.com/aeolun/react-diff-viewer-continued/compare/v4.0.4...v4.0.5) (2025-01-31)


### Bug Fixes

* modify imports for proper esm resolution ([7fda63a](https://github.com/aeolun/react-diff-viewer-continued/commit/7fda63afae8bcd98547c8bdff569d02256821b2d))

## [4.0.4](https://github.com/aeolun/react-diff-viewer-continued/compare/v4.0.3...v4.0.4) (2025-01-28)


### Bug Fixes

* added line number for inline view onLineNumberClick ([0e92dfe](https://github.com/aeolun/react-diff-viewer-continued/commit/0e92dfee2102b42bdd0c51af57c66b0152ad2186))
* fix several type issues and update packages ([23aa832](https://github.com/aeolun/react-diff-viewer-continued/commit/23aa83222e85d303b939eb20699348e449a9174f))
* line break anywhere ([17c51e6](https://github.com/aeolun/react-diff-viewer-continued/commit/17c51e62afd6ffcacee2fe731f1ff0ee44c08e37))

## [4.0.3](https://github.com/aeolun/react-diff-viewer-continued/compare/v4.0.2...v4.0.3) (2024-05-23)


### Reverts

* Revert "refactoring attempt" ([6a9789b](https://github.com/aeolun/react-diff-viewer-continued/commit/6a9789b0af0221bf32be11d1af9d4db3337008f4))

## [4.0.2](https://github.com/aeolun/react-diff-viewer-continued/compare/v4.0.1...v4.0.2) (2024-02-14)


### Bug Fixes

* revert back to table based layout, add example image (fixes [#35](https://github.com/aeolun/react-diff-viewer-continued/issues/35), [#15](https://github.com/aeolun/react-diff-viewer-continued/issues/15), [#21](https://github.com/aeolun/react-diff-viewer-continued/issues/21)) ([a1571ab](https://github.com/aeolun/react-diff-viewer-continued/commit/a1571ab9940c8b917c2e845f537780e4b45efb01))

## [4.0.1](https://github.com/aeolun/react-diff-viewer-continued/compare/v4.0.0...v4.0.1) (2023-11-01)


### Bug Fixes

* publish files on 4.x ([650c249](https://github.com/aeolun/react-diff-viewer-continued/commit/650c249c5bf1d8b27d780b65555df5ae0f5d9e2b))

# [4.0.0](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.3.0...v4.0.0) (2023-10-19)


### Bug Fixes

* do not trim trailing newlines (fixes [#27](https://github.com/aeolun/react-diff-viewer-continued/issues/27)) ([ee4d53f](https://github.com/aeolun/react-diff-viewer-continued/commit/ee4d53f8e2ba3e374b51bffef3a00d3fe6206d02))
* use semantic elements for diff elements (fixes [#23](https://github.com/aeolun/react-diff-viewer-continued/issues/23)) ([a6222c7](https://github.com/aeolun/react-diff-viewer-continued/commit/a6222c7af151e7dc29046c8eac916271866b4899))


* feat!: diff/flexbox based layout, text selectable per side (fixes #15) ([9f6c4d5](https://github.com/aeolun/react-diff-viewer-continued/commit/9f6c4d59e84ecb44761c39e172ffab6a689d5779)), closes [#15](https://github.com/aeolun/react-diff-viewer-continued/issues/15)


### Features

* add summary element and fold expansion/folding (fixes [#22](https://github.com/aeolun/react-diff-viewer-continued/issues/22), [#21](https://github.com/aeolun/react-diff-viewer-continued/issues/21)) ([e47cbe1](https://github.com/aeolun/react-diff-viewer-continued/commit/e47cbe1286a2143b0f8078a683e96edea0ed967b))


### BREAKING CHANGES

* This completely modifies the way react-diff-viewer-continued is rendered. The overall
layout should be more or less the same, but with the new layout probably come new bugs.

# [3.3.0](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.6...v3.3.0) (2023-10-17)


### Bug Fixes

* update dependencies and correct zero width extraLines (fixes [#29](https://github.com/aeolun/react-diff-viewer-continued/issues/29)) ([c4b317a](https://github.com/aeolun/react-diff-viewer-continued/commit/c4b317af31935740dd9fe8ac526ceb8fd63db6a9))


### Features

* add ability to always show certain lines ([896eb32](https://github.com/aeolun/react-diff-viewer-continued/commit/896eb323389cec2055abc7dede40adcbcbf6b506))

## [3.2.6](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.5...v3.2.6) (2023-03-02)


### Bug Fixes

* release for chore fix ([9775afa](https://github.com/aeolun/react-diff-viewer-continued/commit/9775afac2388942d97c839954186eb5b4fd64c3c))

## [3.2.5](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.4...v3.2.5) (2023-01-23)


### Bug Fixes

* correctly break strings for long values so size remains within bounds ([cfa5de1](https://github.com/aeolun/react-diff-viewer-continued/commit/cfa5de1905644c34152dc8a692191d1e32410353))

## [3.2.4](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.3...v3.2.4) (2022-12-23)


### Bug Fixes

* to deploy previous fixes ([06d8361](https://github.com/aeolun/react-diff-viewer-continued/commit/06d83614204d0c48c3ac654b06c43ba42f679c56))

## [3.2.3](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.2...v3.2.3) (2022-11-11)


### Bug Fixes

* update example with JSON ([f61c977](https://github.com/aeolun/react-diff-viewer-continued/commit/f61c977302415774dd32d48aca3addb7122ffa55))

## [3.2.2](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.1...v3.2.2) (2022-10-10)


### Bug Fixes

* move the dependencies for development only to `devDependencies` ([206394c](https://github.com/aeolun/react-diff-viewer-continued/commit/206394cb16352f2c3601383b8510b4dee9578405))

## [3.2.1](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.2.0...v3.2.1) (2022-07-07)


### Bug Fixes

* correct diff line numbering ([bab9977](https://github.com/aeolun/react-diff-viewer-continued/commit/bab99777fd687f85be68fb5c2990e554b6cb70bf))

# [3.2.0](https://github.com/aeolun/react-diff-viewer-continued/compare/v3.1.1...v3.2.0) (2022-07-07)

### Features

- update library for react 17, and add custom gutters ([7193350](https://github.com/aeolun/react-diff-viewer-continued/commit/7193350187ed5b13989e6d5e5ade40f3a45c943b))
