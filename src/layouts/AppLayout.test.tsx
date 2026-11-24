import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from './AppLayout';

const mockLocation = { pathname: '/app' };

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => vi.fn(),
}));

vi.mock('../components/BottomNavigation', () => ({
  default: () => <nav aria-label="Navegação inferior de teste" />,
}));

vi.mock('../contexts/GuestGateContext', () => ({
  useGuestGate: () => ({ isGuest: false, minutesLeft: 0 }),
}));

describe('AppLayout navigation visibility', () => {
  beforeEach(() => {
    mockLocation.pathname = '/app';
  });

  it('keeps the bottom navigation visible on the notifications page', () => {
    mockLocation.pathname = '/notificacoes';
    render(<AppLayout><div>Notificações</div></AppLayout>);

    expect(screen.getByRole('navigation', { name: 'Navegação inferior de teste' })).toBeVisible();
    expect(screen.getByText('Notificações')).toBeVisible();
  });

  it('continues hiding the bottom navigation on the map preview and message threads', () => {
    for (const pathname of ['/mapa-app', '/messages/thread-1']) {
      mockLocation.pathname = pathname;
      const { unmount } = render(<AppLayout><div>Conteúdo</div></AppLayout>);
      expect(screen.queryByRole('navigation', { name: 'Navegação inferior de teste' })).not.toBeInTheDocument();
      unmount();
    }
  });
});
