import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { loadLessonChatPanel } from "@tests/support/lesson-chat-panel";
import { LessonChat } from "@/components/learn/atomy/lesson-chat";
import { Predict } from "@/components/learn/lesson/predict";
import { choices } from "@/components/learn/lesson/responses";
import { Step, Steps } from "@/components/learn/lesson/steps";

beforeAll(loadLessonChatPanel);

const QUESTION = "¿Qué le pasa a la fuerza?";

function Question(): ReactElement {
  return (
    <Predict
      id="cualquiera"
      question={QUESTION}
      response={choices(["×4", "×1", "×1/4"], 1)}
      explanation={<p>Las masas y la distancia se anulan.</p>}
    >
      <p>El experimento</p>
    </Predict>
  );
}

describe("Predict", () => {
  it("asks the question with Atomy and hides the experiment until the reader answers", () => {
    render(<Question />);

    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByText("Atomy")).toBeInTheDocument();
    expect(screen.getByText("¿Tú qué crees?")).toBeInTheDocument();
    expect(screen.queryByText("El experimento")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Comprobar" }),
    ).not.toBeInTheDocument();
  });

  it("shows the experiment once the reader picks an option", async () => {
    render(<Question />);

    await userEvent.click(screen.getByRole("button", { name: "×4" }));

    expect(screen.getByRole("button", { name: "×4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("El experimento")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Haz el experimento de abajo y luego comprueba si has acertado.",
      ),
    ).toBeInTheDocument();
  });

  it("tells the reader they got it right and explains why", async () => {
    const user = userEvent.setup();
    render(<Question />);

    await user.click(screen.getByRole("button", { name: "×1" }));
    await user.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(screen.getByRole("status")).toHaveTextContent("¡Has acertado!");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Las masas y la distancia se anulan.",
    );
  });

  it("tells the reader the right answer when they missed it, and locks the options", async () => {
    const user = userEvent.setup();
    render(<Question />);

    await user.click(screen.getByRole("button", { name: "×4" }));
    await user.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Has elegido «×4», pero la respuesta correcta es «×1».",
    );
    for (const option of ["×4", "×1", "×1/4"]) {
      expect(screen.getByRole("button", { name: option })).toBeDisabled();
    }
  });

  it("shows the next step once the verdict is out", async () => {
    const user = userEvent.setup();
    render(
      <Steps order={["uno", "dos"]}>
        <Step id="uno">
          <Question />
        </Step>
        <Step id="dos">
          <p>Siguiente paso</p>
        </Step>
      </Steps>,
    );
    await user.click(screen.getByRole("button", { name: "×1" }));
    expect(screen.queryByText("Siguiente paso")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(screen.getByText("Siguiente paso")).toBeInTheDocument();
  });

  it("starts answered, with the experiment and the verdict, with showAll", () => {
    render(
      <Steps order={["uno"]} showAll>
        <Step id="uno">
          <Question />
        </Step>
      </Steps>,
    );

    expect(screen.getByText("El experimento")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("¡Has acertado!");
    expect(screen.getByRole("button", { name: "×1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("has no chat button on Atomy outside the advanced mode", () => {
    render(<Question />);

    expect(
      screen.queryByRole("button", {
        name: "Pregúntale a Atomy sobre este experimento",
      }),
    ).not.toBeInTheDocument();
  });

  it("opens the chat about this experiment from Atomy in the advanced mode", async () => {
    render(
      <LessonChat>
        <Question />
      </LessonChat>,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Pregúntale a Atomy sobre este experimento",
      }),
    );

    const chat = screen.getByRole("region", { name: "Chat con Atomy" });
    expect(chat).toHaveTextContent(`Sobre: ${QUESTION}`);
  });
});
