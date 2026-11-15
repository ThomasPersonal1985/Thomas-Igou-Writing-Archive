# Thomas Igou Writing Archive

A responsive reading-room archive with five writing categories, title and subject search, completion filtering, and a full-page reading layer. The catalogue uses Lora and Manrope; the novel uses Playfair Display, and the screenplay uses Courier Prime.

## Files

- `archive.json` contains the catalogue records and tags for 139 works.
- `writing-content.json` contains readable text for all 139 catalogue entries.
- `thomas-igou.jpg` is the author portrait shown in the About section.

The five categories are Short story, Poetry, Novel, Play, and Script. PEP: Pink Is the New Black and New Shit (working title) are grouped under Short story. Screenplays and song lyrics are grouped under Script.

The catalogue omits “Bathroom. Breakdown. Pause:” at the author's request. Original writing documents were not changed.

## Preview locally

Run a local web server from this folder so the browser can load the JSON files:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
