# rodikirk.com

Personal site for Rodi Kirk. Static HTML, CSS and JS (p5.js + Web Audio), no build step for the pages themselves. Served by GitHub Pages from `master` (`CNAME` → www.rodikirk.com). `.nojekyll` makes files serve as-is.

## Structure

```
index.html            home: "strings". Name + music / education / design ride four tuned strings
strings.js            home interaction (real HTML links positioned on the strings)
common.js             shared palette, Web Audio voices, the rolling "set" bar, bio header
style.css             home + sketch styles (bump ?v= in the html when changing it)
keys.html / .js       homepage variant: every key is a sound + shape and inks the bio
bounce.html / .js     homepage variant: throw the ball, hits land on 16ths and print the bio
sketches.html         "more sketches" list (record, orbits, bounce v1 in _archive/v1)
music/ education/ design/   sub pages, generated from content.json
sub.css               sub page styles
assets/thumbs/        square thumbnails for the sub pages
```

## Edit the sub pages

1. Open `editor.html` (locally or at rodikirk.com/editor.html), click text to edit, then **export json**.
2. Save the export over `content.json`.
3. `python3 _build_subpages.py` rebuilds `music/`, `education/`, `design/` and `content.js`.
4. Commit and push.

## Publish

```sh
python3 -m http.server 8000   # preview at localhost:8000
git push                      # push to master → Pages deploys (~30–60s)
```
