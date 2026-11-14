import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GalleryCardLink } from "@/components/gallery/gallery-card-link";

describe("GalleryCardLink", () => {
  it("links to the detail of its solution", () => {
    render(<GalleryCardLink slug="goggles">Goggles</GalleryCardLink>);

    expect(screen.getByRole("link", { name: "Goggles" })).toHaveAttribute(
      "href",
      "/galeria/goggles",
    );
  });
});
