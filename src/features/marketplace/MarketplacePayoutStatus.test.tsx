import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarketplacePayoutStatus } from "./MarketplacePayoutStatus";

const { from, select, eq, order, limit } = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("../../integrations/supabase/client", () => ({
  supabase: { from },
}));

describe("MarketplacePayoutStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ order });
    order.mockReturnValue({ limit });
    limit.mockResolvedValue({ data: [], error: null });
  });

  it("queries only the authenticated recipient and selects no provider secrets or private proof paths", async () => {
    limit.mockResolvedValue({
      data: [{
        id: "payout-1",
        payout_type: "seller",
        amount: 12500,
        currency: "AOA",
        status: "paid",
        payout_reference: "BANK-REF-001",
        created_at: "2026-11-23T10:00:00.000Z",
        paid_at: "2026-11-24T10:00:00.000Z",
      }],
      error: null,
    });

    render(<MarketplacePayoutStatus userId="recipient-1" />);

    expect(await screen.findByText("Venda de produto")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText(/BANK-REF-001/)).toBeInTheDocument();

    expect(from).toHaveBeenCalledWith("marketplace_payouts");
    expect(select).toHaveBeenCalledWith(
      "id,payout_type,amount,currency,status,payout_reference,created_at,paid_at",
    );
    expect(eq).toHaveBeenCalledWith("recipient_user_id", "recipient-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(50);
    expect(select.mock.calls[0][0]).not.toContain("provider_reference");
    expect(select.mock.calls[0][0]).not.toContain("proof_url");
    expect(select.mock.calls[0][0]).not.toContain("beneficiary_id");
  });

  it("shows a neutral empty state when the recipient has no payouts", async () => {
    render(<MarketplacePayoutStatus userId="recipient-2" />);

    expect(await screen.findByText(/Ainda não existem liquidações/)).toBeInTheDocument();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });

  it("shows a recoverable error state when the database query fails", async () => {
    limit.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    render(<MarketplacePayoutStatus userId="recipient-3" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível consultar os pagamentos.",
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
