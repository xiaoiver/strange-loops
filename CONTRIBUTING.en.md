# Contributing to Strange Loops

[简体中文](CONTRIBUTING.md) | English

Bug reports and improvements to mathematics, writing, translations, accessibility, performance, character animation and chapters are welcome. Start with a small issue. For a new chapter, a major route redesign or a new dependency, open an issue first to discuss the experience and scope.

## Run locally

Use Node.js 22 (matching CI), npm and Python 3. Blender is needed only for model, rig or baked-animation changes.

```sh
git clone https://github.com/xiaoiver/strange-loops.git
cd strange-loops/outputs/strange-loop
npm ci
npm test
npm run build
npm start
```

Visit [English](http://localhost:4173/?lang=en) or [中文](http://localhost:4173/?lang=zh). `npm start` serves static files with Python on port 4173. Rebuild and refresh after changes. If that port is busy, choose another port with `python3 -m http.server`.

## Find the source

| Area | Location |
| --- | --- |
| Scenes and companions | `outputs/strange-loop/src/`, including `garden-scene.js`, `figure-ground-scene.js` and `companions.js` |
| Rules and progress | `miu-system.js`, `garden-discovery.js`, `figure-ground-system.js` and their tests |
| Chinese, English and other locales | `copy.js`, `garden-copy.js`, `figure-ground-copy.js`, `gallery-art.js` and `src/locales/` |
| Page and styles | `index.html`, `style.css`, `garden.css`, `figure-ground.css` |
| Models, baking scripts and animation sources | `outputs/characters/`; see the [character guide (Chinese)](outputs/characters/README.md) |
| Current design | [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) and the [chapter-two verification record](outputs/strange-loop/docs/chapter-02-verification.md) |

Short JS paths are relative to `outputs/strange-loop/src/`; page and stylesheet paths are relative to `outputs/strange-loop/`.

## Project conventions

- Preserve the four original MIU rules and the invariant that makes MU unreachable. The engine stores MIU; Chinese maps the display to WJU. Display names must not change derivations or saves.
- Write original dialogue and descriptions. Chinese terminology follows the Commercial Press edition; do not copy published book dialogue. New artwork or models need redistribution permission; attribution and a source link do not replace permission.
- Check all seven locales and accessible names when changing user-facing text. Japanese and Korean use system fonts. If new Chinese text fails font coverage, follow the [font subsetting instructions](outputs/strange-loop/scripts/subset-font.py).
- Preserve the paper-grey palette, PBR lighting, clear figure/ground relationships and restrained motion. Support keyboard operation, system reduced motion and the non-WebGL fallback.
- For model changes, retain editable projects, scripts, provenance and license records, then export an optimized runtime GLB. The code license does not automatically cover models; read the [licensing scope](LICENSING.md).

## Validate and open a PR

For code changes, normally run:

```sh
cd outputs/strange-loop
npm test
npm run build
```

Run relevant tests for behavior changes. Check affected scene, interaction and animation flows in a real browser. For README-only changes, verify links, images and descriptions. CI runs the common test and release checks.

For UI changes, attach actual browser screenshots and state which languages and viewports you checked. Screenshots should show the current build; Chinese and English documentation should use matching UI languages. Before capturing the vestibule, enable all three G/E/B lights and use the default GEB sculpture. Wait for models, fonts and the scene to finish loading before capturing animation states.

Describe the behavior change, validation and any devices or flows you did not check. Keep a PR focused on one goal and include required generated bundles after source changes. Leave out `node_modules/`, `dist/`, local environment files and scratch files.

## Asset and contribution terms

Original code and documentation contributions are accepted under [MIT](LICENSE). You retain copyright; no copyright assignment is required. Submit only material you have the right to offer under these terms.

Models, fonts, images and screenshots containing them follow their [individual terms](LICENSING.md). For new media, record the author, original URL, explicit license or permission, permitted use, modifications and affected paths in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Include upstream license texts where required. If permission is unclear, submit a description or external reference first and add the media file after permission is established.

## Releases

`npm run release` builds the website subpath package from a clean, committed revision and records the source commit and file hashes. LICENSE, LICENSING.md and third-party licenses travel with the package. Do not commit the generated release directory.

Maintainers update the website through a separate Gallery Mate sync PR; see the [deployment guide (Chinese)](outputs/strange-loop/docs/deploy-gallerymate.md). Contributors do not need production credentials or deployment access.
