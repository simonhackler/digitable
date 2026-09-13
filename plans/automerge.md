Every page is an automerge document. It shows cursors etc.
Every project is a seperate automerge document. (Does the overall individual project for a user also have to be an automerge document?)

Implement Reconciliation.

Branching.
(Needs some diffing tools then as well)

Where to implement this?
Ideally this should be a library. However the document for every page looks different?
E.g text vs svg syncs differently.

One workspace folder where all the projects sync into. Just like it is right now.

for a page, a write on the page hits automerge then syncs to the filesystem
filesystem writes get parsed into the appropriate structure, merged into automerged synced and then written back.

Different file types: json, svg, md, csv

