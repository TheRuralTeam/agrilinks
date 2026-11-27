import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const resendSignupConfirmation = vi.fn();
const toastSpy = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    userProfile: null,
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    resendSignupConfirmation: (...args: any[]) => resendSignupConfirmation(...args),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: (...args: any[]) => toastSpy(...args) }));
vi.mock('@/assets/LogoAgriLinkOfficiallNoBackground.png', () => ({ default: 'logo.png' }));

import EmailConfirmation from '../EmailConfirmation';

const renderPage = () => {
  window.history.replaceState({}, '', '/confirmar-email?email=teste@agrilink.ao');
  return render(
    <MemoryRouter initialEntries={['/confirmar-email?email=teste@agrilink.ao']}>
      <EmailConfirmation />
    </MemoryRouter>
  );
};

describe('Fluxo de confirmação por email', () => {
  beforeEach(() => {
    resendSignupConfirmation.mockReset();
    toastSpy.mockReset();
    resendSignupConfirmation.mockResolvedValue({ error: null, accepted: true });
  });
  afterEach(() => vi.useRealTimers());

  it('solicita o link de confirmação para o email indicado', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('teste@agrilink.ao');
    await user.click(screen.getByRole('button', { name: /enviar link de confirmação/i }));

    await waitFor(() => expect(resendSignupConfirmation).toHaveBeenCalledTimes(1));
    expect(resendSignupConfirmation).toHaveBeenCalledWith('teste@agrilink.ao');
  });

  it('só apresenta sucesso depois da aceitação explícita pelo serviço', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /enviar link de confirmação/i }));

    expect(await screen.findByText(/serviço de autenticação aceitou o pedido/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pedido aceite/i })).toBeInTheDocument();
  });

  it('não apresenta sucesso se o serviço não confirmou a aceitação', async () => {
    resendSignupConfirmation.mockResolvedValue({ error: null, accepted: false });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /enviar link de confirmação/i }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erro ao solicitar link', variant: 'destructive' })
    ));
    expect(screen.queryByRole('heading', { name: /Pedido aceite/i })).not.toBeInTheDocument();
  });

  it('aplica cooldown de 60s e bloqueia reenvios imediatos', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /enviar link de confirmação/i }));
    await waitFor(() => expect(resendSignupConfirmation).toHaveBeenCalledTimes(1));

    const resend = await screen.findByRole('button', { name: /Novo pedido em 60s/i });
    expect(resend).toBeDisabled();

    const tick = async (seconds: number) => {
      for (let i = 0; i < seconds; i++) {
        await act(async () => { vi.advanceTimersByTime(1000); });
      }
    };

    await tick(30);
    expect(screen.getByRole('button', { name: /Novo pedido em 30s/i })).toBeDisabled();

    await tick(30);
    const ready = await screen.findByRole('button', { name: /Pedir novo email de confirmação/i });
    expect(ready).not.toBeDisabled();

    await user.click(ready);
    await waitFor(() => expect(resendSignupConfirmation).toHaveBeenCalledTimes(2));
  });

  it('mostra erro quando o pedido de reenvio falha', async () => {
    resendSignupConfirmation.mockResolvedValue({ error: new Error('Erro ao solicitar email') });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /enviar link de confirmação/i }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erro ao solicitar link', variant: 'destructive' })
    ));
    expect(screen.queryByRole('heading', { name: /Pedido aceite/i })).not.toBeInTheDocument();
  });
});