import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createElementNode } from "../registry/definitions";
import { PageRenderer } from "../renderer/PageRenderer";

describe("nested element selection in PageRenderer", () => {
  it("selects nested child without propagating selection to its parent container", () => {
    const section = createElementNode("section");
    section.id = "sec-nested";
    section.label = "Hero Section";

    const heading = createElementNode("heading");
    heading.id = "heading-nested";
    heading.label = "Hero Title";
    heading.props = { text: "Nested Heading Title", tag: "h1" };
    section.children = [heading];

    const onSelectNode = vi.fn();

    render(
      <PageRenderer
        mode="edit"
        nodes={[section]}
        selectedIds={[]}
        onSelectNode={onSelectNode}
      />
    );

    const childText = screen.getByText("Nested Heading Title");
    fireEvent.click(childText);

    expect(onSelectNode).toHaveBeenCalledTimes(1);
    expect(onSelectNode).toHaveBeenCalledWith("heading-nested", {
      additive: false,
    });
  });
});
