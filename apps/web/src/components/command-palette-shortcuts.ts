export type CommandPaletteShortcut =
  | "alt+k"
  | "alt+p"
  | "mod+k"
  | "mod+p"
  | "off";

export const commandPaletteOpenEventName = "media-cdn:open-command-palette";
export const commandPaletteShortcutChangedEventName =
  "media-cdn:command-palette-shortcut-changed";
export const commandPaletteShortcutStorageKey =
  "media-cdn:command-palette-shortcut";
export const defaultCommandPaletteShortcut: CommandPaletteShortcut = "mod+k";

export const commandPaletteShortcutOptions: Array<{
  label: string;
  value: CommandPaletteShortcut;
}> = [
  { label: "Ctrl/Cmd + K", value: "mod+k" },
  { label: "Ctrl/Cmd + P", value: "mod+p" },
  { label: "Alt + K", value: "alt+k" },
  { label: "Alt + P", value: "alt+p" },
  { label: "Off", value: "off" },
];

const commandPaletteShortcutValues = new Set<CommandPaletteShortcut>(
  commandPaletteShortcutOptions.map((option) => option.value)
);

export const getCommandPaletteShortcutLabel = (
  shortcut: CommandPaletteShortcut
) =>
  commandPaletteShortcutOptions.find((option) => option.value === shortcut)
    ?.label ?? "Ctrl/Cmd + K";

export const parseCommandPaletteShortcut = (
  value: null | string
): CommandPaletteShortcut =>
  commandPaletteShortcutValues.has(value as CommandPaletteShortcut)
    ? (value as CommandPaletteShortcut)
    : defaultCommandPaletteShortcut;

export const readCommandPaletteShortcut = () => {
  if (typeof window === "undefined") {
    return defaultCommandPaletteShortcut;
  }

  return parseCommandPaletteShortcut(
    window.localStorage.getItem(commandPaletteShortcutStorageKey)
  );
};

export const updateCommandPaletteShortcut = (
  shortcut: CommandPaletteShortcut
) => {
  window.localStorage.setItem(commandPaletteShortcutStorageKey, shortcut);
  window.dispatchEvent(
    new CustomEvent(commandPaletteShortcutChangedEventName, {
      detail: { shortcut },
    })
  );
};

export const requestCommandPaletteOpen = () => {
  window.dispatchEvent(new Event(commandPaletteOpenEventName));
};

export const isCommandPaletteShortcutEvent = (
  event: KeyboardEvent,
  shortcut: CommandPaletteShortcut
) => {
  const key = event.key.toLowerCase();

  switch (shortcut) {
    case "alt+k":
      return event.altKey && !(event.ctrlKey || event.metaKey) && key === "k";
    case "alt+p":
      return event.altKey && !(event.ctrlKey || event.metaKey) && key === "p";
    case "mod+k":
      return (event.ctrlKey || event.metaKey) && !event.altKey && key === "k";
    case "mod+p":
      return (event.ctrlKey || event.metaKey) && !event.altKey && key === "p";
    case "off":
      return false;
    default:
      return shortcut satisfies never;
  }
};
