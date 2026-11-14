import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AtomyBubble } from "@/components/learn/atomy/atomy-bubble";

describe("AtomyBubble", () => {
  it("shows what Atomy says under its name", () => {
    render(
      <AtomyBubble>
        <p>¿Qué cae antes?</p>
      </AtomyBubble>,
    );

    expect(screen.getByText("Atomy")).toBeInTheDocument();
    expect(screen.getByText("¿Qué cae antes?")).toBeInTheDocument();
  });

  it("puts the reader's replies under the bubble", () => {
    render(
      <AtomyBubble after={<button type="button">Sí</button>}>
        <p>¿Empezamos?</p>
      </AtomyBubble>,
    );

    expect(screen.getByRole("button", { name: "Sí" })).toBeInTheDocument();
  });

  it("announces its words when it is a status", () => {
    render(
      <AtomyBubble role="status">
        <p>¡Acertaste!</p>
      </AtomyBubble>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("¡Acertaste!");
  });

  it("starts talking and marks where its avatar is", () => {
    const { container } = render(
      <AtomyBubble>
        <p>Hola</p>
      </AtomyBubble>,
    );

    const avatar = container.querySelector("[data-atomy-avatar]");
    expect(avatar?.querySelector("svg")).toHaveAttribute(
      "data-state",
      "talking",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("makes the avatar a labelled button when it can be pressed", async () => {
    const onAvatarClick = vi.fn();
    render(
      <AtomyBubble
        onAvatarClick={onAvatarClick}
        avatarLabel="Pregúntale a Atomy sobre este experimento"
      >
        <p>¿Qué cae antes?</p>
      </AtomyBubble>,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Pregúntale a Atomy sobre este experimento",
      }),
    );

    expect(onAvatarClick).toHaveBeenCalledOnce();
  });
});
