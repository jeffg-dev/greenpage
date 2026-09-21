# How Green Page differs from Clean Page

Green Page is a personal fork of Clean Page. Upstream is merged in regularly; these are the intentional differences to preserve when integrating upstream changes.

## Deployment

- The tip of `main` is the product. Every push to `main` deploys to https://greenpage.app. There are no versioned releases, no dev/production split, and no release-tag build.
- Hosting is a Cloudflare Worker with static assets, deployed by GitHub Actions using a Cloudflare token scoped to Workers on this account and the `greenpage.app` zone.

## Identity

- The app is called Green Page everywhere a user can see it (page title, About, manifest). The website is https://greenpage.app.
- The README is a one-paragraph statement: Green Page is a personalized fork of Clean Page, its license, its URL, nothing more.

## Fonts

- Settings offers a third face, Monospace (Source Code Pro), next to Serif and Sans-serif.

## Toolbar

- Buttons are icons rather than words: New, Open, Save (or Download), Settings. Their names stay available to assistive technology.
- Print, Copy, Undo and Redo buttons are gone. Printing remains through the browser (Ctrl+P); undo and redo remain on the keyboard.

## Drafts

- Every page is a draft with a name. A new page is named automatically from a number word and an asteroid name, for example `one-themis.txt` or `twentyone-polyhymnia.txt`.
- The name is shown in the top bar. Clicking it lets you rename the draft.
- Drafts save themselves in the browser as you type. Reloading a tab brings back its draft; opening a new tab starts a new draft. Nothing leaves the device.
- Open is a menu: Open → File… opens a text file from disk, as upstream does. Open → Draft… lists the drafts kept in this browser so one can be brought back or deleted.
- Save offers two choices: keep the writing as a draft under a (possibly different) name, or download it as a file.
- Because drafts persist, Green Page does not ask for confirmation before New or Open and does not warn when the tab is closed.
