# Thomas Igou Writing Archive

A responsive reading-room catalogue with form-led browsing, title and subject search, completion filtering, and individual catalogue records.

## Preview

Open `index.html` through a local web server so the browser can load `archive.json`:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Archive contents

`archive.json` contains the 140 work records from the corrected inventory, including the individual poems and the corrected statuses for the screenplay *Tom* and the song. It contains catalogue descriptions and tags, not the full manuscript text. The source documents remain in their original folders and were not changed.

The next content step is to bring selected full texts into a web-readable format and check each conversion against its source. The unfinished drafts and any sensitive work should stay in a private GitHub repository until you decide what is ready to make public.
