import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBackgroundImageCss,
  parseBackgroundImage,
} from "@/features/builder/background-image";
import { adminMediaApi } from "@/lib/commerce-api";
import { MediaPickerModal } from "../MediaPickerModal";
import { getBrandPaletteOptions } from "../brand-palette";
import {
  BackgroundImageControl,
  ColorControl,
  PropertyPopoverRow,
} from "../inspector-controls";

describe("Popover inspector groups, Brand palette picker, Background Fill, and uniform modal tabs", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("parses and builds safe CSS background images with opacity overlay", () => {
    expect(buildBackgroundImageCss({ imageUrl: "javascript:alert(1)" })).toBe("");
    expect(
      buildBackgroundImageCss({
        imageUrl: "/media/jacket.jpg",
        imageOpacity: 1,
      })
    ).toBe("url(/media/jacket.jpg)");

    const cssWithOverlay = buildBackgroundImageCss({
      imageUrl: "/media/jacket.jpg",
      imageOpacity: 0.6,
      overlayColor: "#C85A32",
    });
    expect(cssWithOverlay).toBe(
      "linear-gradient(rgba(200,90,50,0.4), rgba(200,90,50,0.4)), url(/media/jacket.jpg)"
    );

    const parsed = parseBackgroundImage(cssWithOverlay);
    expect(parsed.imageUrl).toBe("/media/jacket.jpg");
    expect(parsed.imageOpacity).toBeCloseTo(0.6, 2);
    expect(parsed.overlayColor).toBe("#C85A32");
  });

  it("opens ColorControl inside a Base UI Popover with Brand Palette first, + add inline, and Custom last", () => {
    const palette = getBrandPaletteOptions({
      version: 1,
      colors: {
        primary: "#274E36",
        secondary: "#1F2937",
        accent: "#18794E",
        background: "#FFFFFF",
        surface: "#F8FAFC",
        text: "#111318",
        muted: "#5C6270",
        border: "#E5E7EB",
      },
      customPalette: [{ id: "sand", name: "Warm Sand", hex: "#D6C3A5" }],
      typography: { headingFont: "Georgia", bodyFont: "Inter" },
      radius: { card: "10px", button: "8px" },
      container: { maxWidth: "1280px" },
    });

    const onChange = vi.fn();
    const onAddPaletteColor = vi.fn();

    render(
      <ColorControl
        label="Text Color"
        value="#274E36"
        palette={palette}
        onAddPaletteColor={onAddPaletteColor}
        onChange={onChange}
      />
    );

    // Compact row trigger only — swatches stay collapsed until opened
    expect(
      screen.queryByRole("group", { name: "Text Color Brand Palette" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Text Color: Primary" }));

    const group = screen.getByRole("group", { name: "Text Color Brand Palette" });
    const buttons = Array.from(group.querySelectorAll("button"));
    expect(buttons[0]).toHaveAttribute("aria-label", "Select Primary (#274E36)");
    expect(buttons[buttons.length - 1]).toHaveAttribute(
      "aria-label",
      "Text Color custom color"
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Warm Sand (#D6C3A5)" }));
    expect(onChange).toHaveBeenCalledWith("#D6C3A5");

    fireEvent.click(screen.getByRole("button", { name: "Text Color custom color" }));
    const hexInput = screen.getByLabelText("Text Color hex value");
    fireEvent.change(hexInput, { target: { value: "#334155" } });
    expect(onChange).toHaveBeenCalledWith("#334155");

    fireEvent.click(
      screen.getByRole("button", { name: "Add color to Brand Palette" })
    );
    fireEvent.change(screen.getByLabelText("Brand color name"), {
      target: { value: "Terracotta" },
    });
    fireEvent.change(screen.getByLabelText("New brand color hex"), {
      target: { value: "#C85A32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to Palette" }));

    expect(onAddPaletteColor).toHaveBeenCalledWith("Terracotta", "#C85A32");
    expect(onChange).toHaveBeenCalledWith("#C85A32");
  });

  it("opens BackgroundImageControl Popover cleanly and updates position, opacity, and Library trigger", () => {
    const onChangeStyles = vi.fn();
    const onOpenLibrary = vi.fn();

    render(
      <BackgroundImageControl
        backgroundImage="url(/media/jacket.jpg)"
        backgroundPosition="center"
        backgroundSize="cover"
        backgroundRepeat="no-repeat"
        backgroundAttachment="scroll"
        onOpenLibrary={onOpenLibrary}
        onChangeStyles={onChangeStyles}
      />
    );

    const trigger = screen.getByRole("button", {
      name: "Background Fill: jacket.jpg · 100%",
    });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Position Top Center" }));
    expect(onChangeStyles).toHaveBeenCalledWith({
      backgroundPosition: "center top",
    });

    const opacitySlider = screen.getByLabelText("Image Opacity");
    fireEvent.change(opacitySlider, { target: { value: "50" } });
    expect(onChangeStyles).toHaveBeenCalledWith({
      backgroundImage:
        "linear-gradient(rgba(17,19,24,0.5), rgba(17,19,24,0.5)), url(/media/jacket.jpg)",
    });

    fireEvent.click(screen.getByRole("button", { name: /Library/i }));
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
  });

  it("opens PropertyPopoverRow content on click", () => {
    render(
      <PropertyPopoverRow label="Typography" summary="Inter · 16px · 400">
        <div>Grouped Typography Fields</div>
      </PropertyPopoverRow>
    );

    expect(
      screen.queryByText("Grouped Typography Fields")
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Typography: Inter · 16px · 400" })
    );
    expect(screen.getByText("Grouped Typography Fields")).toBeInTheDocument();
  });

  it("keeps a fixed tabpanel container across Media Library and Store Assets tabs in MediaPickerModal", async () => {
    vi.spyOn(adminMediaApi, "list").mockResolvedValue([]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MediaPickerModal
          open
          canUploadMedia
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>
    );

    const tabpanel = await screen.findByRole("tabpanel");
    expect(tabpanel).toHaveClass("ed-media-panel-body");

    fireEvent.click(screen.getByRole("tab", { name: /Store Assets/i }));
    const panelAfter = screen.getByRole("tabpanel");
    expect(panelAfter).toHaveClass("ed-media-panel-body");
    expect(screen.getByText("Alpine Shell Jacket")).toBeInTheDocument();
  });
});
