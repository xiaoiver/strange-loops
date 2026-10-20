# Strange Loops · 怪圈

[简体中文](README.md) | English

An interactive narrative exhibition in Chinese and English, inspired by *Gödel, Escher, Bach: an Eternal Golden Braid*. The vestibule explores G, E, and B as projections of a single sculpture. Chapter one, MU Garden, lets you rewrite symbols using four formal rules. Achilles and the Tortoise accompany you in both rooms.

Built with Three.js PBR materials, PCSS soft shadows, and GTAO, the vestibule supports drag-to-explore camera controls, three letter views, individual light switches, custom three-letter sculpture generation (`?s=XYZ`), Chinese/English switching, and skeletal idle animations for both characters. The writing and character models are original tributes to the book.

![English vestibule screenshot showing the GEB sculpture, wall shadows, Achilles, and the Tortoise](outputs/strange-loop/docs/screenshots/vestibule-en.jpg)

## Preview locally

The repository includes the built website and models. You can preview it without installing dependencies:

```sh
cd outputs/strange-loop
python3 -m http.server 4173
```

Open <http://localhost:4173>. Serve the files over HTTP rather than opening the HTML file directly.

## Edit and build

```sh
cd outputs/strange-loop
npm ci
npm test
npm run build
npm start
```

The website is static; its publish directory is `outputs/strange-loop`. See the [website README (Chinese)](outputs/strange-loop/README.md) for details on rendering, interactions, and copy.

## Project structure

- `outputs/strange-loop/`: website source, dependency lockfile, build scripts, built JavaScript, sculpture geometry, and character GLB files.
- `outputs/characters/`: editable Blender project, modeling and animation generation script, rendered preview, and [character documentation (Chinese)](outputs/characters/README.md).
- `PRODUCT.md` and `DESIGN.md`: product direction and approved design guidelines, written in Chinese.

The Blender character project includes rigs, materials, and Idle / Walk / Look animation clips. Rebuild instructions are in the character documentation.

## Current scope

The vestibule and chapter one are playable. MU Garden includes one-tap rewrites, occurrence selection when needed, animated 3D letters, branching derivation history, a reachable onboarding target, and optional observation hints. Progress survives language changes, lobby visits, and reloads. The rule interface also works without WebGL. Chapter two and later rooms are not yet open.

![English MU Garden screenshot showing the skylight, rule table, and recessed doorway](outputs/strange-loop/docs/screenshots/garden-en.jpg)

The repository does not include the book's full text, cover scans, or images of Escher's works. Dependency and font notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
