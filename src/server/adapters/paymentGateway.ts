/**
 * IPaymentGateway – Phase 2 contract for Sri Lankan gateways (PayHere / DirectPay / WebXPay).
 *
 * PCI-DSS rule: card numbers NEVER touch this system. The customer enters the card on the
 * gateway's hosted page; we only store the opaque `paymentToken` it returns and later send a
 * "charge this token for X cents" command. Every charge result becomes a PAYMENT ledger row.
 */
export interface ChargeRequest {
  customerId: string;
  amountCents: number;
  idempotencyKey: string;
  paymentToken?: string;
}

export interface ChargeResult {
  ok: boolean;
  gatewayReference: string | null;
  failureReason?: string;
}

export interface IPaymentGateway {
  readonly name: string;
  /** Returns a hosted-page URL where the customer links a card (tokenization). */
  createTokenizationSession(customerId: string): Promise<{ url: string }>;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

/** Phase 1 – money is handled in person (cash). Nothing to call. */
export class CashCreditAdapter implements IPaymentGateway {
  readonly name = "cash-credit";

  async createTokenizationSession(): Promise<{ url: string }> {
    throw new Error("Card payments are not enabled in Phase 1");
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    return { ok: true, gatewayReference: `cash:${req.idempotencyKey}` };
  }
}
