import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Revealed,
  Step,
  Steps,
  useResolveStep,
} from "@/components/learn/lesson/steps";
import { ProgressProvider } from "@/components/shared/progress";
import { createProgressStore } from "@/lib/progress/progress-store";

function Experiment({ name }: { name: string }): ReactElement {
  const resolve = useResolveStep();
  return (
    <button type="button" onClick={resolve}>
      {name}
    </button>
  );
}

const ORDER = ["uno", "dos", "tres"];

function Lesson(): ReactElement {
  return (
    <Steps order={ORDER}>
      <Step id="uno">
        <p>Paso 1</p>
        <Experiment name="Resolver 1" />
        <Revealed>
          <p>Cierre del paso 1</p>
        </Revealed>
      </Step>
      <Step id="dos">
        <p>Paso 2</p>
        <Experiment name="Resolver 2" />
      </Step>
      <Step id="tres">
        <p>Paso 3</p>
      </Step>
    </Steps>
  );
}

describe("Steps", () => {
  it("shows every step at once with showAll", () => {
    render(
      <Steps order={ORDER} showAll>
        <Step id="uno">
          <p>Paso 1</p>
        </Step>
        <Step id="tres">
          <p>Paso 3</p>
          <Revealed>
            <p>Cierre del paso 3</p>
          </Revealed>
        </Step>
      </Steps>,
    );

    expect(screen.getByText("Paso 1")).toBeInTheDocument();
    expect(screen.getByText("Paso 3")).toBeInTheDocument();
    expect(screen.getByText("Cierre del paso 3")).toBeInTheDocument();
  });

  it("shows only the first step at first", () => {
    render(<Lesson />);

    expect(screen.getByText("Paso 1")).toBeInTheDocument();
    expect(screen.queryByText("Cierre del paso 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Paso 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Paso 3")).not.toBeInTheDocument();
  });

  it("shows every part of the next step once an experiment is resolved", async () => {
    const user = userEvent.setup();
    render(<Lesson />);

    await user.click(screen.getByRole("button", { name: "Resolver 1" }));

    expect(screen.getByText("Paso 2")).toBeInTheDocument();
    expect(screen.getByText("Cierre del paso 1")).toBeInTheDocument();
    expect(screen.queryByText("Paso 3")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resolver 2" }));
    expect(screen.getByText("Paso 3")).toBeInTheDocument();
  });

  it("never hides a step again when an earlier experiment is resolved again", async () => {
    const user = userEvent.setup();
    render(<Lesson />);
    await user.click(screen.getByRole("button", { name: "Resolver 1" }));
    await user.click(screen.getByRole("button", { name: "Resolver 2" }));

    await user.click(screen.getByRole("button", { name: "Resolver 1" }));

    expect(screen.getByText("Paso 3")).toBeInTheDocument();
  });

  it("shows every step outside a Steps", () => {
    render(
      <>
        <Step id="uno">
          <p>Paso 1</p>
        </Step>
        <Step id="cinco">
          <p>Paso 5</p>
          <Experiment name="Resolver 5" />
          <Revealed>
            <p>Cierre del paso 5</p>
          </Revealed>
        </Step>
      </>,
    );

    expect(screen.getByText("Paso 5")).toBeInTheDocument();
    expect(screen.getByText("Cierre del paso 5")).toBeInTheDocument();
  });

  it("fails on a step missing from the order", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <Steps order={ORDER}>
          <Step id="cuatro">
            <p>Paso 4</p>
          </Step>
        </Steps>,
      ),
    ).toThrow('The step "cuatro" is not in the order of <Steps>.');
  });

  it("keeps the steps unlocked when a step is inserted before them", async () => {
    const user = userEvent.setup();
    const store = createProgressStore("pasos-test", () => undefined);
    const { rerender } = render(
      <ProgressProvider store={store} restoreScroll={false}>
        <Lesson />
      </ProgressProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Resolver 1" }));

    rerender(
      <ProgressProvider store={store} restoreScroll={false}>
        <Steps order={["cero", ...ORDER]}>
          <Step id="cero">
            <p>Paso 0</p>
          </Step>
          <Step id="dos">
            <p>Paso 2</p>
          </Step>
          <Step id="tres">
            <p>Paso 3</p>
          </Step>
        </Steps>
      </ProgressProvider>,
    );

    expect(screen.getByText("Paso 0")).toBeInTheDocument();
    expect(screen.getByText("Paso 2")).toBeInTheDocument();
    expect(screen.queryByText("Paso 3")).not.toBeInTheDocument();
  });
});
