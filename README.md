# ⚽ Onze

A daily Wordle-style football guessing game.

- **Squads** — name one player from each of 5 `(club, season)` squads.
- **Find the link** — name one player who turned out for all of 2–3 given clubs.

Free-text guessing (surname is enough, word order doesn't matter), three difficulties,
and a spoiler-free shareable result. Top-5 European leagues, seasons 2016/17–2025/26.

## Run locally

```sh
python3 -m http.server 8765   # then open http://localhost:8765
```

The game is fully static — `index.html` + `data/squads.json`, no backend.

## Rebuild the data

`tools/build-data.mjs` regenerates `data/squads.json` from squad CSVs (EA FC 26 +
FIFA 17–23). Player/squad facts only; not affiliated with EA or FIFA.

```sh
node tools/build-data.mjs
```
