# تصاویر اسلایدها / Slide photos

Put a photo named `<key>.jpg` (or .jpeg/.png/.webp) in this folder and run
`node build.js` — the matching slide slot is filled automatically (cover-cropped).
Slots without a file show a designed icon panel.

| key | slide | suggested photo |
|---|---|---|
| title | 1 | mosque dome and minarets at sunrise |
| intro | 3 | sea/mountain horizon at sunrise |
| shokr_div | 4 | hands raised in prayer / a table of bread and fruit |
| shokr_def | 5 | a seedling growing from soil |
| shokr_verse | 6 | open Quran with soft light |
| noah | 10 | ship on the sea |
| solomon | 10 | historic palace / crown |
| prophet | 10 | night sky with moon over a mosque |
| shokr_ways | 13 | green leaves with raindrops |
| tav_div | 14 | mountain in mist |
| tav_def | 15 | a road toward the horizon |
| musa | 21 | the sea |
| cave | 21 | cave in a mountain |
| mominin | 21 | caravan in the desert |
| day_morning | 23 | sunrise |
| day_work | 23 | desk / hands at work |
| day_night | 23 | starry night sky |
| summary | 24 | hands in prayer / sunrise |
| closing | 25 | mosque at dusk (a dark scrim is added automatically) |

Run with: `NODE_PATH=<dir with pptxgenjs react react-dom react-icons sharp> APPLY_THEME=<path to apply_theme.js> node build.js`

## Provided photos (from the supplied 8-card collage)
`images/tiles/` holds the 8 separated cards (with their original text). The text-free photo regions
were cropped into: title, intro, shokr_def, shokr_verse, tav_div, tav_def, day_night, day_morning.
Still icon placeholders: shokr_div, shokr_ways, noah, solomon, prophet, musa, cave, mominin, day_work, summary, closing.
