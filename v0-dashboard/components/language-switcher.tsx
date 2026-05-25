"use client"

import { Check, Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { languages, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n()
  const active = languages.find((item) => item.code === language) || languages[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn("border-slate-200 bg-white text-slate-700", compact && "h-8 px-2")}
          aria-label={t("common.language")}
        >
          <Languages className="h-4 w-4" />
          <span className={compact ? "text-xs" : "text-sm"}>{active.shortLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((item) => (
          <DropdownMenuItem
            key={item.code}
            className="flex cursor-pointer items-center justify-between"
            onClick={() => setLanguage(item.code)}
          >
            <span>{item.label}</span>
            {language === item.code ? <Check className="h-4 w-4 text-blue-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
