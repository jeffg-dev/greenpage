export const S = {
  appName: "Green Page",

  toolbar: "Writing tools",
  newDoc: "New",
  open: "Open",
  openFile: "File…",
  openDraft: "Draft…",
  save: "Save",
  download: "Download",
  settings: "Settings",
  rename: "Rename",
  docNameLabel: "Document name",

  letters: "Letters",
  lettersSerif: "Serif",
  lettersSansSerif: "Sans-serif",
  lettersMono: "Monospace",

  fontSize: "Font size",
  sizeRegular: "Regular",
  sizeLarge: "Large",
  onScreenColors: "On-Screen Colors",
  colorsLight: "Light",
  colorsDark: "Dark",
  resetSettings: "Reset",
  applySettings: "Apply",
  cancel: "Cancel",
  close: "Close",
  previewLetters: "Aa Bb",
  previewSize: "Aa",

  about: "About",
  website: "https://greenpage.app",
  newTab: "(opens in a new tab)",

  saveTitle: "Save your writing",
  saveName: "Name",
  saveDraft: "Save draft",
  nameRequired: "Enter a name.",
  nameInvalid: "A name needs some letters or numbers in it.",

  draftsTitle: "Drafts",
  draftsEmpty: "No drafts yet.",
  draftsDelete: (name: string) => `Delete ${name}`,

  // The writing surface
  pageLabel: "Your writing",
  tabHint: "To reach the buttons, press Alt and F. Escape returns to writing.",
  tabHintMac: "To reach the buttons, press Control, Option and F. Escape returns to writing.",

  // Saved indicator
  saved: "Saved",

  // Page count, announced to screen readers only
  pageCount: (n: number) => (n === 1 ? "Now 1 page." : `Now ${n} pages.`),

  // Problems, in plain words
  errSave: "Sorry, that did not save. Try again.",
  errNew: "Sorry, that did not start a new page. Try again.",
  errOpen: "Sorry, that file did not open. Try again.",
  errNotText: "That file isn't plain writing. Open a plain text file (.txt) instead.",
  errTitle: "Something went wrong",
  errOk: "OK",
  settingsStorageError: "Could not keep your settings on this device.",
  draftsStorageError: "Could not keep your drafts on this device.",
} as const;
