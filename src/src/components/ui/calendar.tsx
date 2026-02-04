"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-6",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        // Navigation spans the full caption width so arrows sit at the edges
        nav: "absolute inset-x-0 flex items-center w-full px-4",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "mr-auto",
        nav_button_next: "ml-auto",
        table: "w-full border-separate [border-spacing:0.5rem]",
        head_row: "",
        head_cell:
          "text-muted-foreground rounded-md w-10 text-center font-normal text-[0.8rem]",
        row: "",
        cell: cn(
          "relative p-0 text-center text-sm align-middle focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[#FF3A2E]/10",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-lg [&:has(>.day-range-start)]:rounded-l-lg"
            : "[&:has([aria-selected])]:rounded-lg",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "w-10 h-10 p-0 font-normal aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-[#FF3A2E] aria-selected:text-white",
        day_range_end:
          "day-range-end aria-selected:bg-[#FF3A2E] aria-selected:text-white",
        day_selected:
          "bg-[#FF3A2E] text-white hover:bg-[#FF3A2E] hover:text-white focus:bg-[#FF3A2E] focus:text-white",
        day_today:
          "border border-[#FF3A2E]/40 text-[#FF3A2E] font-semibold",
        day_outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-[#FF3A2E]/10 aria-selected:text-[#FF3A2E]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
