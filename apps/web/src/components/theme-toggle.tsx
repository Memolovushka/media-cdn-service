"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
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
  { icon: SunIcon, label: "White", value: "light" },
  { icon: MoonIcon, label: "Black", value: "dark" },
  { icon: LaptopIcon, label: "System", value: "system" },
];

const getThemeIcon = (theme?: string) =>
  themeOptions.find((option) => option.value === theme)?.icon ?? LaptopIcon;

export const ThemeToggle = () => {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const ThemeIcon = getThemeIcon(theme);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <TooltipHint content="Change site theme">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Change site theme"
            disabled={!mounted}
            size="icon"
            type="button"
            variant="outline"
          >
            <ThemeIcon />
          </Button>
        </DropdownMenuTrigger>
      </TooltipHint>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => setTheme(value as ThemeMode)}
          value={(theme as ThemeMode | undefined) ?? "system"}
        >
          {themeOptions.map((option) => {
            const OptionIcon = option.icon;

            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <OptionIcon />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
