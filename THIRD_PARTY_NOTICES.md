# Third-party notices

The project’s original software uses the [MIT License](LICENSE). The [licensing scope](LICENSING.md) distinguishes that grant from the separate component and asset terms below. This document preserves attribution and upstream terms; it does not grant missing rights to third-party media.

The web bundle uses Three.js. The sculpture generator uses three-bvh-csg and three-mesh-bvh, and derives its letter geometry from the Helvetiker Bold font shipped with Three.js. The chapter-one gallery uses the Optimer Regular font from the same distribution.

Noto Serif SC is bundled as a self-hosted WOFF2 subset under the derived family name Strange Loops Serif SC (weights 400–700), with system font fallbacks. Source revision and SHA-256 are pinned in outputs/strange-loop/assets/fonts/subset.json. The SIL Open Font License and upstream copyright are included in assets/fonts/OFL.txt. Rebuild instructions: outputs/strange-loop/scripts/subset-font.py.

## Three.js

The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## three-bvh-csg

MIT License

Copyright (c) 2022 Garrett Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## three-mesh-bvh

MIT License

Copyright (c) 2018 Garrett Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Helvetiker Bold and Optimer Regular / Magenta font license

Copyright @ 2004 by MAGENTA Ltd. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of the fonts accompanying this license ("Fonts") and associated documentation files (the "Font Software"), to reproduce and distribute the Font Software, including without limitation the rights to use, copy, merge, publish, distribute, and/or sell copies of the Font Software, and to permit persons to whom the Font Software is furnished to do so, subject to the following conditions:

The above copyright and this permission notice shall be included in all copies of one or more of the Font Software typefaces.

The Font Software may be modified, altered, or added to, and in particular the designs of glyphs or characters in the Fonts may be modified and additional glyphs or characters may be added to the Fonts, only if the fonts are renamed to names not containing the word "MgOpen", or if the modifications are accepted for inclusion in the Font Software itself by the each appointed Administrator.

This License becomes null and void to the extent applicable to Fonts or Font Software that has been modified and is distributed under the "MgOpen" name.

The Font Software may be sold as part of a larger software package but no copy of one or more of the Font Software typefaces may be sold by itself.

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL MAGENTA OR PERSONS OR BODIES IN CHARGE OF ADMINISTRATION AND MAINTENANCE OF THE FONT SOFTWARE BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

## Achilles mannequin

[STYLE Fortnite-creative-mannequin](https://sketchfab.com/3d-models/style-fortnite-creative-mannequin-5da12762b03a40078e21e51a1e185e8c) by [POLLO28](https://sketchfab.com/POLLO28), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The original author, title, source and license are recorded in the user-supplied GLB metadata.

Adaptations in this project: mesh reduction, removal of unused helper bones and objects, grayscale PBR material, scale normalization, and new idle / walk / look animation adaptation. The source file is preserved as `outputs/characters/source/pollo28-mannequin.glb`; credit is also available in the seven-language chapter map and exported GLB extras.

## Tortoise generated with Tripo

The Tortoise was generated by the user with **Tripo** and supplied to this project as a GLB. It was subsequently cleaned up, simplified, rigged, and adapted for animation in Blender. The original generated asset is preserved as `outputs/characters/source/tripo-tortoise.glb`.

On 2026-10-22, the maintainer confirmed that this model was generated on a paid plan with the model set to private. Generation and output rights remain subject to the [Tripo terms](https://www.tripo3d.ai/terms). This project does not add a separate open-content reuse license for the tortoise; it is excluded from the project MIT grant. Contact the maintainer for redistribution permission. The Blender processing scripts are original software covered by MIT; processing the model does not replace its asset terms.

## cannon-es

Chapter-one letter-pile rigid-body simulation. MIT License.

/*
 * Copyright (c) 2015 cannon.js Authors
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

## The Lobster posters (chapter two)

- Files: `outputs/strange-loop/assets/art/the-lobster.jpg` and `the-lobster-weisz.jpg`, each 786 × 1113 JPEG. Both are complete images, not cropped, mirrored, recolored or repainted.
- Work: *The Lobster* (2015), the Colin Farrell and Rachel Weisz official absent-embrace poster pair. Poster design: **Vasilis Marmatakis**. The film's director is Yorgos Lanthimos; the exhibition credits Marmatakis specifically for poster design. Copyright remains with the respective rights holders; these images are not CC BY, public domain, or original assets of this repository.
- User selection: https://github.com/xiaoiver/strange-loops/pull/5#issuecomment-6313129108
- Colin Farrell version: https://origin.dazeddigital.com/film-tv/gallery/26029/4/yorgos-lanthimos-s-movie-posters . Image: https://images-prod.dazeddigital.com/786/azure/dazed-prod/1250/6/1256972.jpg
- Rachel Weisz version: https://origin.dazeddigital.com/film-tv/gallery/26029/5/yorgos-lanthimos-s-movie-posters . Image: https://images-prod.dazeddigital.com/786/azure/dazed-prod/1250/6/1256973.jpg
- Retrieved 2026-10-21. Both gallery slides identify the work as an official poster. Designer interview: https://origin.dazeddigital.com/film-tv/article/42750/1/yorgos-lanthimos-posters-the-favourite-lobster-vasilis-marmatakis-interview
- Included at the user's request as two attributed works for specific commentary on negative space. An accessible on-page museum label identifies title, designer, year and individual sources in all seven languages. The pair is the first main-route stop by the gallery entrance, followed by the shared-contour wall. It supplies visual commentary, not mathematical evidence; no viewing timer or external link visit is required. This record documents provenance and context, not a grant of reproduction or sublicensing rights.
- The Rubin-style shared contour (`assets/art/rubin-contour.svg` / `src/rubin-contour.js`) is drawn independently for this exhibition and is not traced from an Escher image or either poster.

## Rubin vase research label (chapter two)

- The independently drawn `rubin-contour.svg` and shared-contour walls remain original exhibit geometry; no historical plate or third-party illustration is bundled.
- The on-page label credits Edgar Rubin’s figure–ground research, published in 1915 in *Synsoplevede Figurer: Studier i psykologisk Analyse*. The year labels the research, not this exhibition’s wall design.
- Primary publication, digitized by the Royal Danish Library: https://www.kb.dk/e-mat/dod/111408024790-bw.pdf . Bibliographic details and 1915 date are identified on the library’s cover sheet.
- Supporting explanation of shared contours and the face/vase interpretation: Hanover College, *Ambiguous Figure-Ground Perception*: https://isle.hanover.edu/Ch05Object/Ch05AmbigFigGround_evt.html
- The seven-language introduction is original short commentary. Sources are linked, not reproduced or packaged.

## PQINA Flip (chapter counter)

- Package: `@pqina/flip` 1.8.4.
- Source: https://github.com/pqina/flip
- Used for the footer split-flap chapter numbers; local styles adapt the panels to the exhibition.

```text
MIT License

Copyright (c) 2020 PQINA | Rik Schennink <rik@pqina.nl>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Quaternius Walk_Formal_Loop and Walk_Loop (Achilles animation)

- Author: **Quaternius**. Source: https://quaternius.com/packs/universalanimationlibrary.html
- License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/ . The supplied archive's license is preserved at `outputs/characters/source/quaternius-LICENSE.txt`.
- The user supplied `Universal Animation Library[Standard].zip`. `Walk_Formal_Loop` and its reference mannequin were extracted from `Unreal-Godot/UAL1_Standard_RM.glb`; the extracted clip is preserved in `outputs/characters/source/quaternius-walk-formal-loop.glb`. The `Walk_Loop` reference is preserved separately as `quaternius-walk-loop.glb`. Its shoulders, arms, elbows and wrists are now retargeted and phase-aligned onto the Formal lower body by `outputs/characters/refine_mannequin_arms.py`; Idle, Look and Jog are preserved. The runtime therefore ships an adapted composite walk, alongside the chapter-passage jog.
- Adaptation: Blender rest-pose calibration and retargeting to the existing POLLO28 skeleton, proportional pelvis/limb movement, shoe-contact fitting, removal of root translation, and distance-driven playback. The runtime `Achilles_Walk` combines the Formal lower body with phase-aligned `Walk_Loop` arms. The walk additionally uses soft-knee pelvis clearance, a stable projected knee pole and cyclic ankle smoothing, authored in Blender. The POLLO28 mesh and its CC BY 4.0 attribution remain separate and unchanged.
- Editable project: `outputs/characters/geb-companions-ual.blend`; reproducible retarget script: `outputs/characters/retarget_ual_walk.py`. Original Idle / Look and the tortoise are preserved.

The chapter-map credits show the animation package, selected clips, Quaternius author and CC0 1.0 license links beside the model credit in all seven interface languages; the Chinese static HTML fallback includes the same animation credit.

The chapter passage additionally uses Quaternius `Jog_Fwd_Loop` from the same CC0 Standard archive, preserved as `outputs/characters/source/quaternius-jog-fwd-loop.glb`. The original source's large stride and flight height are adapted to a light jog (30% longitudinal excursion, 40% sole clearance in the light-jog revision, with separately reduced pelvis bounce), then fitted to the existing rig and shoes; root translation is removed. The runtime `Achilles_Jog` is distance-driven. The light-jog revision reduces trunk lean and coordinates the shoulder/arm motion around its neutral running pose. Both selected clip names are listed in the seven-language map credit. The current editable four-action studio is `outputs/characters/geb-companions-motion.blend`; the previous `geb-companions-jog.blend` remains available.

## Google Draco decoders

Copyright 2016 The Draco Authors. The bundled `draco_decoder.js`, `draco_wasm_wrapper.js` and `draco_decoder.wasm` in `outputs/strange-loop/assets/draco/` come from the Three.js Draco distribution and retain the Apache License 2.0. The upstream license text is preserved in `assets/draco/LICENSE` within the website and release package. Source: https://github.com/google/draco ; license text source: https://github.com/google/draco/blob/1.5.7/LICENSE . The project MIT grant does not replace this license.
