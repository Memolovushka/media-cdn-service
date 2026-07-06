"use client";

import { Button } from "@workspace/ui/components/button";
import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { TooltipHint } from "@/components/tooltip-hint";

type ThemeMode = "dark" | "light" | "system";

const themeOptions: Array<{
  icon: typeof SunIcon;
  label: string;
  value: ThemeMode;
}> = [
  { icon: SunIcon, label: "Light", value: "light" },
  { icon: MoonIcon, label: "Dark", value: "dark" },
  { icon: LaptopIcon, label: "System", value: "system" },
];

const getThemeIcon = (theme?: string) =>
  themeOptions.find((option) => option.value === theme)?.icon ?? LaptopIcon;

const getNextTheme = (theme?: string): ThemeMode => {
  const currentTheme = themeOptions.findIndex(
    (option) => option.value === theme
  );
  const nextTheme = themeOptions.at((currentTheme + 1) % themeOptions.length);

  return nextTheme?.value ?? "system";
};

const getThemeLabel = (theme?: string) =>
  themeOptions.find((option) => option.value === theme)?.label ?? "System";

const isEditableKeyboardTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox']"
    )
  );

export const ThemeToggle = () => {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const ThemeIcon = getThemeIcon(theme);
  const currentThemeLabel = getThemeLabel(theme);
  const nextTheme = getNextTheme(theme);
  const nextThemeLabel = getThemeLabel(nextTheme);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableKeyboardTarget(event.target) ||
        event.key.toLowerCase() !== "d"
      ) {
        return;
      }

      event.preventDefault();
      setTheme(getNextTheme(theme));
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setTheme, theme]);

  const cycleTheme = () => setTheme(nextTheme);

  return (
    <TooltipHint
      content={`Theme: ${currentThemeLabel}. Click or press D for ${nextThemeLabel}.`}
    >
      <Button
        aria-label={`Theme: ${currentThemeLabel}. Switch to ${nextThemeLabel}.`}
        disabled={!mounted}
        onClick={cycleTheme}
        size="icon"
        type="button"
        variant="outline"
      >
        <ThemeIcon />
      </Button>
    </TooltipHint>
  );
};
