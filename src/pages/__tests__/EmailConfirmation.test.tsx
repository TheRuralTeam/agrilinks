import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
const toastSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invoke(...args) },
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, userProfile: null, logout: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: (...args: any[]) => toastSpy(...args) }));
vi.mock("@/assets/orbislink-logo.png", () => ({ default: "logo.png" }));

import EmailConfirmation from "@/pages/EmailConfirmation";

const renderPage = () => {
  window.history.replaceState({}, "", "/confirmar-email?email=teste@agrilink.ao");
  return render(
    <MemoryRouter initialEntries={["/confirmar-email?email=teste@agrilink.ao"]}>
      <EmailConfirmation />
    </MemoryRouter>,
  );
};

describe("Fluxo de confirmação por email", () => {
  beforeEach(() => {
    invoke.mockReset();
    toastSpy.mockReset();
    invoke.mockResolvedValue({ data: { success: true, expires_in_minutes: 60 }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("envia o link de confirmação com o email e o redirect de callback", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("teste@agrilink.ao");
    await user.click(screen.getByRole("button", { name: /enviar link de confirmação/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [fnName, options] = invoke.mock.calls[0];
    expect(fnName).toBe("send-confirmation-email");
    expect(options.body.email).toBe("teste@agrilink.ao");
    expect(options.body.redirect_to).toContain("/auth/callback?next=/app");
  });

  it("mostra a mensagem de link enviado com expiração de 1 hora", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /enviar link de confirmação/i }));

    expect(await screen.findByText(/Enviámos um link de confirmação/i)).toBeInTheDocument();
    expect(screen.getByText(/expira em 1 hora/i)).toBeInTheDocument();
  });

  it("aplica debounce de 60s e bloqueia reenvios imediatos", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /enviar link de confirmação/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

    const resend = await screen.findByRole("button", { name: /Reenviar link em 60s/i });
    expect(resend).toBeDisabled();

    const tick = async (seconds: number) => {
      for (let i = 0; i < seconds; i++) {
        await act(async () => { vi.advanceTimersByTime(1000); });
      }
    };

    await tick(30);
    expect(screen.getByRole("button", { name: /Reenviar link em 30s/i })).toBeDisabled();

    await tick(30);
    const ready = await screen.findByRole("button", { name: /Reenviar link de confirmação/i });
    expect(ready).not.toBeDisabled();

    await user.click(ready);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  });

  it("mostra erro quando o envio do email falha", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Erro ao enviar email") });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /enviar link de confirmação/i }));

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Erro ao enviar link", variant: "destructive" }),
      ),
    );
    expect(screen.queryByText(/Enviámos um link de confirmação/i)).not.toBeInTheDocument();
  });
});
