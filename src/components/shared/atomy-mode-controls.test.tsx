import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";
import {
  ATOMY_NO_KEY_COOKIE,
  saveModeChoice,
} from "@/components/atomy/atomy-cookie";
import {
  AtomyModeProvider,
  RETRY_DELAYS_MS,
  STATUS_URL,
  reducedModeNotice,
  reducedReasons,
  useAdvancedMode,
  type NonEmpty,
  type ReducedReason,
} from "@/components/shared/atomy-mode";
import {
  AtomyModeSwitch,
  ReducedModeBand,
  earlyBandScript,
} from "@/components/shared/atomy-mode-controls";
import type { ModelStatus } from "@/lib/atomy/model-status";

let online = true;
let status: ModelStatus = "available";

beforeEach(() => {
  online = true;
  status = "available";
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(Response.json({ status })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  saveModeChoice("ia");
  document.cookie = `${ATOMY_NO_KEY_COOKIE}=; path=/; max-age=0`;
});

function Mode(): ReactElement {
  const advanced = useAdvancedMode({
    modelConfigured: true,
    choice: "ia",
  });
  return <p>{advanced ? "Con IA" : "Sin IA"}</p>;
}

async function renderControls() {
  render(
    <AtomyModeProvider>
      <AtomyModeSwitch />
      <ReducedModeBand />
      <Mode />
    </AtomyModeProvider>,
  );
  await act(() => Promise.resolve());
  return screen.getByRole("switch", { name: "Modo reducido" });
}

describe("the reduced mode's switch", () => {
  it("is off by default, with the model available, and no band", async () => {
    const toggle = await renderControls();

    expect(toggle).not.toBeChecked();
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(screen.getByText("Con IA")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(fetch).toHaveBeenCalledWith(STATUS_URL, expect.anything());
  });

  it("turns the reduced mode on and remembers it in a cookie", async () => {
    const user = userEvent.setup();
    const toggle = await renderControls();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(screen.getByText("Sin IA")).toBeInTheDocument();
    expect(document.cookie).toContain("atomy-modo=reduced");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Modo reducido: activado con el interruptor de la cabecera. Puedes desactivarlo en cualquier momento. Atomy sigue guiando los experimentos sin IA.",
    );
    expect(toggle).toHaveAccessibleDescription(reducedModeNotice(["chosen"]));

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(document.cookie).not.toContain("atomy-modo");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows on and disabled, described by the band, without the key", async () => {
    status = "no-key";

    const toggle = await renderControls();

    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).toHaveAccessibleDescription(reducedModeNotice(["no-key"]));
    expect(screen.getByText("Sin IA")).toBeInTheDocument();
  });

  it("stays in the tab order without the key, and a click changes nothing", async () => {
    status = "no-key";
    saveModeChoice("reduced");
    const user = userEvent.setup();
    const toggle = await renderControls();

    await user.tab();
    expect(toggle).toHaveFocus();
    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(screen.getByText("Sin IA")).toBeInTheDocument();
    expect(document.cookie).toContain("atomy-modo=reduced");
  });

  it("knows from the page, before the status answers, that the server has no key", () => {
    // The status never answers.
    vi.mocked(fetch).mockImplementation(() => new Promise(() => undefined));

    function NoKeyMode(): ReactElement {
      const advanced = useAdvancedMode({
        modelConfigured: false,
        choice: "ia",
      });
      return <p>{advanced ? "Con IA" : "Sin IA"}</p>;
    }
    render(
      <AtomyModeProvider>
        <AtomyModeSwitch />
        <ReducedModeBand />
        <NoKeyMode />
      </AtomyModeProvider>,
    );

    const toggle = screen.getByRole("switch", { name: "Modo reducido" });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      reducedModeNotice(["no-key"]),
    );
    expect(screen.getByText("Sin IA")).toBeInTheDocument();
  });

  it("knows from the proxy's cookie, before the status answers, that the server has no key", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => undefined));
    document.cookie = `${ATOMY_NO_KEY_COOKIE}=1; path=/`;

    render(
      <AtomyModeProvider>
        <AtomyModeSwitch />
        <ReducedModeBand />
        <Mode />
      </AtomyModeProvider>,
    );

    expect(
      screen.getByRole("switch", { name: "Modo reducido" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      reducedModeNotice(["no-key"]),
    );
    expect(screen.getByText("Sin IA")).toBeInTheDocument();
  });

  it("takes the status's answer over the proxy's cookie", async () => {
    document.cookie = `${ATOMY_NO_KEY_COOKIE}=1; path=/`;

    const toggle = await renderControls();

    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it.each([{ status: "bogus" }, { state: "available" }, null, "available"])(
    "ignores an answer that names no status (%j)",
    async (body) => {
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(Response.json(body)),
      );
      document.cookie = `${ATOMY_NO_KEY_COOKIE}=1; path=/`;

      const toggle = await renderControls();

      expect(toggle).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("status")).toHaveTextContent(
        reducedModeNotice(["no-key"]),
      );
    },
  );

  it("shows off and disabled while the server cannot reach the model", async () => {
    status = "unreachable";

    const toggle = await renderControls();

    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).toHaveAccessibleDescription(
      reducedModeNotice(["unreachable"]),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Modo reducido: sin respuesta del modelo de lenguaje. Atomy sigue guiando los experimentos sin IA.",
    );
  });

  it("names the browser's connection, not the server's, once the browser goes offline", async () => {
    status = "unreachable";
    await renderControls();

    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      reducedModeNotice(["offline"]),
    );
  });

  it("follows the browser's connection, and asks again when it comes back", async () => {
    const toggle = await renderControls();

    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      reducedModeNotice(["offline"]),
    );
    expect(screen.getByText("Sin IA")).toBeInTheDocument();

    online = true;
    await act(() => {
      window.dispatchEvent(new Event("online"));
      return Promise.resolve();
    });

    expect(toggle).not.toBeChecked();
    expect(screen.getByText("Con IA")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the newest status when an older answer comes in after it", async () => {
    let answerFirst: (response: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          answerFirst = resolve;
        }),
    );
    const toggle = await renderControls();

    // The connection drops and comes back while the first question is out:
    // the second one answers first.
    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    online = true;
    await act(() => {
      window.dispatchEvent(new Event("online"));
      return Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(toggle).not.toBeChecked();

    await act(async () => {
      answerFirst(Response.json({ status: "unreachable" }));
      await Promise.resolve();
    });
    await act(() => Promise.resolve());

    expect(toggle).not.toBeChecked();
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("asks again, each time later, while the server cannot reach the model with the browser online", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      status = "unreachable";
      const toggle = await renderControls();
      expect(toggle).toHaveAttribute("aria-disabled", "true");
      expect(fetch).toHaveBeenCalledTimes(1);

      await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]));
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith(
        `${STATUS_URL}?fresh`,
        expect.anything(),
      );
      expect(toggle).toHaveAttribute("aria-disabled", "true");

      await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1] - 1));
      expect(fetch).toHaveBeenCalledTimes(2);

      status = "available";
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(toggle).not.toHaveAttribute("aria-disabled");
      expect(toggle).not.toBeChecked();
      expect(screen.getByText("Con IA")).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2] * 2));
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks again when the tab comes back to the foreground while the model is out of reach", async () => {
    status = "unreachable";
    const toggle = await renderControls();
    expect(toggle).toHaveAttribute("aria-disabled", "true");

    status = "available";
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      return Promise.resolve();
    });
    await act(() => Promise.resolve());

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(screen.getByText("Con IA")).toBeInTheDocument();
  });

  it("keeps the reader's choice of the reduced mode once the model comes back", async () => {
    saveModeChoice("reduced");
    online = false;

    const toggle = await renderControls();
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Modo reducido: sin conexión con el modelo de lenguaje y activado con el interruptor de la cabecera. Atomy sigue guiando los experimentos sin IA.",
    );

    online = true;
    await act(() => {
      window.dispatchEvent(new Event("online"));
      return Promise.resolve();
    });

    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(toggle).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      reducedModeNotice(["chosen"]),
    );
  });

  it("names every reason that holds at once", async () => {
    status = "no-key";
    saveModeChoice("reduced");
    const toggle = await renderControls();

    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Modo reducido: sin modelo de lenguaje configurado, sin conexión con el modelo de lenguaje y activado con el interruptor de la cabecera. Atomy sigue guiando los experimentos sin IA.",
    );
  });
});

describe("the reduced mode's notice", () => {
  it("has no reason to name while nothing keeps the advanced mode off", () => {
    expect(reducedReasons([], "ia")).toBeNull();
    expect(reducedReasons([], null)).toBeNull();
    expectTypeOf(reducedModeNotice)
      .parameter(0)
      .toEqualTypeOf<NonEmpty<ReducedReason>>();
  });

  it("names the model's reason alone", () => {
    expect(reducedModeNotice(["offline"])).toBe(
      "Modo reducido: sin conexión con el modelo de lenguaje. Atomy sigue guiando los experimentos sin IA.",
    );
  });

  it("names the reader's choice of the reduced mode after the model's reasons", () => {
    expect(reducedReasons(["unreachable"], "reduced")).toEqual([
      "unreachable",
      "chosen",
    ]);
  });

  it("tells that the switch undoes the choice only when nothing else holds", () => {
    expect(reducedModeNotice(["offline", "chosen"])).not.toContain(
      "en cualquier momento",
    );
  });
});

describe("the band before the page is hydrated", () => {
  function drawEarlyBand(): HTMLElement {
    const slot = document.createElement("div");
    slot.id = "atomy-modo-reducido-previo";
    document.body.append(slot);
    // The inline script, run as the browser runs it while parsing the page.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- that script
    Reflect.apply(new Function(earlyBandScript()), undefined, []);
    slot.remove();
    return slot;
  }

  it("is not drawn with the key, the connection and the advanced mode", () => {
    expect(drawEarlyBand()).toBeEmptyDOMElement();
  });

  it.each([
    [
      ["chosen"],
      (): void => {
        saveModeChoice("reduced");
      },
    ],
    [
      ["no-key"],
      (): void => {
        document.cookie = `${ATOMY_NO_KEY_COOKIE}=1; path=/`;
        status = "no-key";
      },
    ],
    [
      ["offline"],
      (): void => {
        online = false;
      },
    ],
    [
      ["no-key", "offline", "chosen"],
      (): void => {
        document.cookie = `${ATOMY_NO_KEY_COOKIE}=1; path=/`;
        status = "no-key";
        online = false;
        saveModeChoice("reduced");
      },
    ],
  ] as const)("names %j as the band will", async (reasons, arrange) => {
    arrange();

    const early = drawEarlyBand().firstElementChild;
    await renderControls();
    const band = document.getElementById("atomy-modo-reducido");

    expect(early?.textContent).toBe(reducedModeNotice(reasons));
    expect(band).toHaveTextContent(reducedModeNotice(reasons));
    expect(early?.tagName).toBe(band?.tagName);
    expect(early?.className).toBe(band?.className);
  });
});
