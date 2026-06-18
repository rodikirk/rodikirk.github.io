# rodikirk.com

Personal site for Rodi Kirk. Plain static HTML + CSS, no build step.
Served by GitHub Pages at the domain root (`CNAME` → www.rodikirk.com).
`.nojekyll` disables Jekyll so files serve as-is.

## Structure

```
index.html        the home page (intro, work, watch & listen, sketches)
style.css         the shared stylesheet — home + all project pages
_template/        starter for a project subpage (not a live route)
<slug>/index.html each project lives here → rodikirk.com/<slug>/
CNAME             custom domain
```

## Add a project page

```sh
cp -r _template my-project          # pick a url slug
# edit my-project/index.html — title, meta, summary, prose, images
git add my-project && git commit -m "Add my-project" && git push
# live at https://rodikirk.com/my-project/
```

## Add a sketch

Drop a new `<li class="sketch">` at the **top** of the `.feed` list in `index.html`,
then commit & push.

## Edit / publish

```sh
python3 -m http.server 8000   # preview at localhost:8000
git push                      # push to master → Pages auto-deploys (~30–60s)
```
