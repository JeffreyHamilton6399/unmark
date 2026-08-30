"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackButton } from "@/components/feedback-button";
import { Logo } from "./logo";
import { SiteSettingsMenu } from "@/components/site-settings-menu";

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <Logo size={20} />
        <span className="text-sm font-semibold tracking-tight">Unmark</span>
      </div>
      <div className="flex items-center gap-1.5">
        <FeedbackButton />
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <a
            href="https://buymeacoffee.com/jeffreyscof"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Heart className="size-3.5" />
            <span className="hidden sm:inline">Donate</span>
          </a>
        </Button>
        <SiteSettingsMenu />
      </div>
    </header>
  );
}
