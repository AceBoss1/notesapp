# Notes Life: two looks (plan)

> Status: **plan, decided by the owner on 1 November 2026; nothing built yet beyond the Low res button (v0.106.1).** Phones play the
> current 3D world fine; computers with big screens froze. The answer is two looks the player chooses between, on any device:
> a light **pixel** look (what Low res becomes) and a richer **HD** look with your own avatar and a city map. Mockups first, as for
> every game feature (HANDOVER §3): phone and desktop, for the owner's approval, before building.

## 1. What's decided

| Question | Decision |
|---|---|
| Low res | Becomes a **pixel-art** look: characters and places drawn as pixel art, so it is light enough for any computer or phone. Today it is the same 3D world with fewer pixels and no shadows. |
| HD | A richer 3D look: **choose your look** (your own avatar), people and places with more detail, chat beside the scene, jobs with a timer and a score, and a **city map** to travel and buy property. |
| Switching | The HD / LOW RES button (top bar and Settings) chooses the look, remembered on the device, as now. |
| The game itself | One game: the same save, money, needs, jobs, deals, places and friends in both looks. Only the drawing changes. |
| Our own world | Inspired by the feel of life and city-building games, never copied: our characters, our places (Abuja first: Wuse, Garki, Maitama, the Central Business District), our names and our art. |

## 2. How it fits the code today

- `components/life/world.ts` draws the 3D world with three.js and gives the game one small interface: `show(scene)`, `walk(spot)`,
  `goTo(place, spot)`, `onTags(listener)` (the tappable labels), `dispose()`. `LifeGame.tsx` and the game rules (`lib/life/*`) only use
  that interface.
- So each look is a **renderer** behind the same interface: `createWorld` (HD, three.js), and `createPixelWorld` (pixel, a 2D
  canvas). `LifeGame` picks one from the look the player chose. No game rule changes.

## 3. The pixel look (what Low res becomes)

- **Drawing:** a 2D canvas at a small internal size (about 320 × 180), scaled up with `image-rendering: pixelated`, so it stays crisp
  and costs almost nothing. Drawn only when something moves.
- **Characters:** small sprites (about 16 × 32 pixels) built in layers: skin tone, hair (afro, braids, locs, low cut, gele, cap),
  outfit (the game's outfits: ankara, kaftan, agbada, shirt and trousers, uniform), so every outfit in the shop has a pixel version.
  Walk cycles of four frames in four directions.
- **Places:** each scene (your room, the Wuse street, Zone 4 market and Wuse II, Chef Adams, itel Energy, Candellux front and pool, the
  DW office) as a tiled pixel picture with the same spots the 3D world has, so walking, tags and labels line up.
- **Day and night, NEPA:** a colour palette per time of day and a darker one for a blackout, with lamp, generator and Power GO glows.
- **Files:** sprite sheets and tiles in `public/images/life/pixel/` (WebP), drawn by us or commissioned; one JSON per scene with its
  spots and tags.

## 4. The HD look

- **Choose your look:** a dressing room at the start and from Settings: body, skin tone, face, hair and colour, outfit, shoes and
  accessories, shown on a turning avatar; saved with your game. Your NotesApp profile picture stays your portrait in lists.
- **People:** smoother characters with simple faces and idle, walk, sit and work animations; residents and other players wear their own
  looks.
- **Chat beside the scene:** the place's public chat on the right (computers) or a slide-up sheet (phones), using the existing friends
  and chat rules for young members.
- **Jobs on screen:** a shift shows its goal, a counter and a timer (for example, Chef Adams: plates served out of the target, time
  left), and pays at the end, as jobs do now.
- **City map:** an illustrated Abuja map (Wuse, Garki, Maitama, the Central Business District, the City Gate) with the places you can
  go and **properties for sale**: price pins, what each pays per game day, and Buy. Your properties and daily property income sit at
  the bottom with Buy properties, Hustle (jobs and deals) and Dashboard. Properties use game money (Notesville Naira), never real money.
- **Weight:** HD keeps the same limits as today (shared shapes and materials, shadows only on people, no drawing while hidden), so
  computers that struggle can switch to the pixel look.

## 5. Build steps

1. **Mockups** (for approval): the pixel room and Wuse street; the HD dressing room, a place with chat, a job with its timer, and the
   city map, each on a phone and a computer.
2. **Renderer interface:** make `World` an interface; `createWorld` (HD) and `createPixelWorld` implement it; `LifeGame` chooses by the
   look (the Low res setting becomes "Pixel / HD").
3. **Pixel world, first places:** your room and the Wuse street, with the player and residents; then the other places.
4. **Avatar:** the look saved with the game (lib/life), the dressing room, and HD characters wearing it; pixel sprites built from the
   same choices.
5. **City map and properties:** the map view, property rules in `lib/life` (price, income per game day, upkeep), buying and the
   property income line, and the Dashboard.
6. **Chat beside the scene and on-screen jobs** in HD.
7. **Tests, help, changelog, roadmap, home, About, README and HANDOVER** with each step that ships (the public pages rule).
