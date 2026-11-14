import { render, screen } from "@testing-library/react";
import { useRef, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Lines,
  textWidth,
  useTextZoom,
  wrap,
} from "@/components/learn/experiments/text-zoom";
import { renderAtWidth } from "@tests/support/rendered-width";

function Zoom({ viewBoxWidth }: { viewBoxWidth: number }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useTextZoom(ref, viewBoxWidth);
  return <div ref={ref}>{zoom}</div>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTextZoom", () => {
  it("is 1 while nothing is measured", () => {
    render(<Zoom viewBoxWidth={560} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("grows as the drawing renders narrower than its viewBox", () => {
    renderAtWidth(280);
    render(<Zoom viewBoxWidth={560} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("stays at 1 when the drawing renders wider than its viewBox", () => {
    renderAtWidth(800);
    render(<Zoom viewBoxWidth={560} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

describe("textWidth", () => {
  it("counts spaces and punctuation as half a character", () => {
    expect(textWidth("ab", 10)).toBe(12);
    expect(textWidth("a, b", 10)).toBe(12 + 6);
  });
});

describe("wrap", () => {
  it("keeps a line that fits whole", () => {
    expect(wrap("Tiempo hasta el suelo", 10, 200)).toEqual([
      "Tiempo hasta el suelo",
    ]);
  });

  it("breaks between words when the line is too wide", () => {
    expect(wrap("Tiempo hasta el suelo", 10, 80)).toEqual([
      "Tiempo hasta",
      "el suelo",
    ]);
  });

  it("leaves alone a word wider than the line", () => {
    expect(wrap("dinamómetro", 10, 20)).toEqual(["dinamómetro"]);
  });
});

describe("Lines", () => {
  it("reads as one sentence", () => {
    const { container } = render(
      <svg>
        <Lines
          lines={["Tiempo hasta", "el suelo"]}
          x={0}
          y={10}
          fontSize={10}
        />
      </svg>,
    );
    expect(container.querySelector("text")).toHaveTextContent(
      "Tiempo hasta el suelo",
    );
    expect(container.querySelectorAll("tspan")).toHaveLength(2);
  });
});
