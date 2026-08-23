# Feature: onze-nfl

## Wave: DISCOVER / [REF] Persona ID
`nfl-fan-daily-gamer` — NFL-Fan (wachsender Markt, auch DACH/Europa), spielt bereits tägliche Rate-Spiele (Wordle-Ritual), teilt Ergebnisse im Freundeskreis.

## Wave: DISCOVER / [REF] Opportunity statement
NFL-Fans fehlt ein tägliches Kader-Ratespiel im Onze-Stil; die Mechanik ist live bewiesen (Onze, ~30–40 tägliche Spieler), und es gab konkrete Nachfragen nach einer NFL-Variante.

## Wave: DISCOVER / [REF] Validated assumptions
- **Mechanik funktioniert & bindet** — Onze läuft live mit 30–40 täglichen Spielern (werbeabhängig). Konfidenz: hoch (echte Nutzungsdaten).
- **Nachfrage existiert** — Peter wurde konkret nach einer NFL-Variante gefragt; NFL-Markt (v.a. international) wächst. Konfidenz: mittel (anekdotisch, wenige Datenpunkte).
- **Datenquelle vorhanden** — nflverse liefert freie, wöchentliche Roster-Daten als CSV/Parquet zurück bis 2002 (github.com/nflverse/nflverse-data), passt zum bestehenden `build-data.mjs`-Ansatz. Konfidenz: hoch (verifiziert 2026-08-23).
- **Squads-Modus ist differenzierend** — kein gefundener Wettbewerber bietet "nenne je einen Spieler aus 5 Kadern"; der Markt macht Grids und Mystery Player. Konfidenz: mittel.

## Wave: DISCOVER / [REF] Invalidated assumptions
- **"Mystery Player ist ein freies Feld"** — widerlegt: Weddle, Griddle, Sportsdle und Dynasty Daddy bieten exakt tägliche NFL-Mystery-Player-Spiele; Immaculate Grid (Sports Reference) dominiert das Trivia-Segment. Der Modus allein trägt das Produkt nicht (Web-Recherche 2026-08-23).

## Wave: DISCOVER / [REF] Dropped options
- Weitere Spielmodi über Squads + Mystery Player hinaus — bewusst out of scope (Peters Vorgabe, Spaß-Projekt).
- Monetarisierung als Ziel — nicht Zweck dieses Projekts; es ist Markttest + Spaß.
- Lizenzierte Daten (EA Madden o.ä.) — unnötig, nflverse deckt den Bedarf frei ab.

## Wave: DISCOVER / [REF] Decision gate (G1-G4)
- **G1 Problem lohnt sich**: PASS (mit Spaß-Projekt-Maßstab: geringer Einsatz, Wiederverwendung von Onze-Code, echtes Lerninteresse "was geht in der NFL").
- **G2 Zielgruppe erreichbar**: PASS unter Vorbehalt — Vertriebskanal zu NFL-Fans ist ungetestet; Onze-Publikum ist fußballaffin. Kleinster Test: NFL-Variante beim bestehenden Onze-Publikum + 1–2 NFL-Communities (Reddit r/nfl(-EU), deutsche NFL-Podcasts/Discords) ankündigen.
- **G3 Lösung differenziert**: PASS — Squads-Modus als USP führen, Mystery Player als Zweitmodus (dort ist der Markt gesättigt).
- **G4 Machbarkeit**: PASS — statische Architektur + nflverse-Daten; Hauptarbeit ist Daten-Pipeline und Schwierigkeitsbalance.

## Wave: DISCOVER / [REF] Constraints established
- 53-Mann-Kader + Practice Squad + hohe Fluktuation: Squads-Modus braucht andere Balance als Fußball (z.B. nur aktive Roster einer bestimmten Woche, Positions-Einschränkungen wie "nenne einen Offense-Starter", oder Punkte nach Bekanntheit). Quelle: NFL-Kaderstruktur.
- Namensraum: viele Allerweltsnamen (Smith, Johnson, Brown) — Freitext-Matching aus Onze muss mit Vornamens-Disambiguierung umgehen.
- Nur Spieler-/Kader-Fakten verwenden, keine NFL-Marken/Logos (gleiche Vorsicht wie bei EA/FIFA in Onze).

## Wave: DELIVER / [REF] Implementation summary
Pragmatischer Prototyp (nWave-Zwischenwellen bewusst übersprungen, Nutzer-Entscheid 2026-08-23): lauffähiges Spiel unter `/Users/peter/onze-nfl` — Onze-Frontend wiederverwendet, neue Daten-Pipeline `tools/build-data.mjs` aus nflverse-Roster-CSVs (2016–2025, 32 Franchises über Relocations gefaltet, 6581 Spieler). Modi: Rosters (Lead) + Mystery Player (300 Clue-Sets aus Position/College/Draft/Trikot/Team-Pfad); Link/Grid in Daten vorhanden, UI-seitig versteckt; Career nicht portiert. Beide Modi im Browser end-to-end verifiziert (Guess lösen, Clue-Unlock, Share-Text). Offen: Name/Domain/Favicon/Share-URL, Fame-Tuning (Proxy aus Tenure+Draft, keine Ratings).

## Wave: DISCOVER / [REF] Pre-requisites
- Keine (DISCOVER ist erste Welle). Für DISCUSS: Entscheidung eigenes Repo vs. Fork von Onze, Name des Spiels, Saisonabdeckung (Vorschlag analog Onze: ~2016–2025 via nflverse).
