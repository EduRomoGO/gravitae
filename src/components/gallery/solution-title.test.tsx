import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SolutionTitle } from "@/components/gallery/solution-title";

describe("SolutionTitle", () => {
  it("shows the name as the page heading and takes the focus on entry", () => {
    render(<SolutionTitle name="Goggles" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Goggles",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});
