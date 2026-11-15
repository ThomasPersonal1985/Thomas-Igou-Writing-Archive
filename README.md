# Thomas Igou Writing Archive

A responsive reading-room archive with form-led browsing, title and subject search, completion filtering, and full-text reading views.

## Files

- `archive.json` contains the catalogue records and tags for 140 works.
- `writing-content.json` contains readable text for 136 works, including stories, poems split from the collections, the novel, play, screenplay, and song.
- Three poems remain catalogued without full text because their only supplied copies are legacy WPS files that could not be converted: *Breaking News*, *Bathroom. Breakdown. Pause:*, and *Sometimes…*.

Original documents were not changed. Imported text is served directly by the public site.

## Preview locally

Run a local web server from this folder so the browser can load the JSON files:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
