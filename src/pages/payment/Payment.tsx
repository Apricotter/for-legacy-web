import { useEffect, useState } from "preact/hooks";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import styled from "styled-components/macro";

import {
    WizardModal,
    WizardHeader,
    WizardTitle,
    WizardContent,
} from "../../components/shared/WizardModal";

const CompactContent = styled(WizardContent)`
    padding: 10px 18px 12px;
`;
import { PrimaryCTA } from "../../components/shared/PrimaryCTA";

const stripePromise = loadStripe(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string,
);

const PAYMENT_INTENT_URL = "/api/payment-intent";
const BG = "/assets/web/bg-gallery-payment.png";

// ── Styled helpers ────────────────────────────────────────────────────────────

const OrderRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(244, 185, 120, 0.08);
    border: 1px solid rgba(244, 185, 120, 0.2);
    border-radius: 8px;
    margin-bottom: 6px;
`;

const OrderLabel = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.88);
`;

const OrderSub = styled.div`
    font-size: 10px;
    color: rgba(255, 255, 255, 0.38);
    margin-top: 1px;
`;

const OrderPrice = styled.div`
    font-size: 18px;
    font-weight: 800;
    color: #f4b978;
    line-height: 1;
`;

const CustomerBox = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    margin-bottom: 6px;
`;

const Avatar = styled.div`
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(244, 185, 120, 0.15);
    border: 1px solid rgba(244, 185, 120, 0.3);
    color: #f4b978;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const CustomerInfo = styled.div`
    min-width: 0;
`;

const CustomerName = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.88);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const CustomerEmail = styled.div`
    font-size: 10.5px;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const RowLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(255, 255, 255, 0.32);
    margin-bottom: 5px;
`;

const StripeWrap = styled.div`
    margin-bottom: 10px;
`;

const ErrorMsg = styled.div`
    font-size: 12px;
    color: #ff6b6b;
    padding: 7px 11px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.22);
    border-radius: 7px;
    margin-bottom: 10px;
`;

const Fine = styled.p`
    margin: 7px 0 0;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
    text-align: center;
    line-height: 1.5;
`;

const Loading = styled.div`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 20px 0;
`;

const SuccessWrap = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 8px 0;
    gap: 8px;
`;

const SuccessIcon = styled.div`
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: rgba(244, 185, 120, 0.15);
    border: 1.5px solid #f4b978;
    color: #f4b978;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const SuccessTitle = styled.div`
    font-size: 17px;
    font-weight: 700;
    color: white;
`;

const SuccessBody = styled.div`
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.6;
    max-width: 320px;
    strong { color: rgba(255, 255, 255, 0.85); }
`;

const SuccessHint = styled.div`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.28);
    line-height: 1.5;
    max-width: 300px;
`;

// ── Stripe appearance ─────────────────────────────────────────────────────────

const stripeAppearance = {
    theme: "flat" as const,
    variables: {
        colorPrimary: "#F4B978",
        colorBackground: "#1c1108",
        colorText: "#f0e8d8",
        colorTextPlaceholder: "rgba(240,232,216,0.35)",
        colorTextSecondary: "rgba(240,232,216,0.55)",
        colorDanger: "#ff6b6b",
        borderRadius: "8px",
        fontFamily: "Inter, -apple-system, sans-serif",
        fontSizeBase: "13px",
        spacingUnit: "3px",
        spacingGridRow: "10px",
    },
    rules: {
        ".Input": {
            border: "1px solid rgba(255,255,255,0.14)",
            backgroundColor: "rgba(255,255,255,0.07)",
            color: "#f0e8d8",
            padding: "7px 11px",
            boxShadow: "none",
        },
        ".Input:focus": {
            border: "1px solid rgba(244,185,120,0.55)",
            boxShadow: "0 0 0 3px rgba(244,185,120,0.12)",
        },
        ".Label": {
            color: "rgba(240,232,216,0.45)",
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "6px",
        },
        ".Tab": {
            border: "1px solid rgba(255,255,255,0.1)",
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "rgba(240,232,216,0.6)",
        },
        ".Tab--selected": {
            border: "1px solid rgba(244,185,120,0.4)",
            backgroundColor: "rgba(244,185,120,0.08)",
            color: "#f4b978",
        },
        ".TabIcon": { fill: "rgba(240,232,216,0.6)" },
        ".TabIcon--selected": { fill: "#f4b978" },
    },
};

// ── Checkout form ─────────────────────────────────────────────────────────────

function CheckoutForm({ name, email }: { name: string; email: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setLoading(true);
        setError(null);

        const { error: submitError } = await elements.submit();
        if (submitError) {
            setError(submitError.message ?? "Something went wrong.");
            setLoading(false);
            return;
        }

        const { error: confirmError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                payment_method_data: { billing_details: { name, email } },
                return_url: `${window.location.origin}/gallery/confirmed`,
            },
            redirect: "if_required",
        });

        if (confirmError) {
            setError(confirmError.message ?? "Payment failed.");
            setLoading(false);
            return;
        }

        setDone(true);
        setLoading(false);
    };

    if (done) {
        return (
            <SuccessWrap>
                <SuccessIcon>{"✓"}</SuccessIcon>
                <SuccessTitle>{"You're in the queue."}</SuccessTitle>
                <SuccessBody>
                    {"Your $20 is on hold — nothing charged yet. Check "}
                    <strong>{email}</strong>
                    {" for your invitation from Otto."}
                </SuccessBody>
                <SuccessHint>
                    {"Once you review your watermarked gallery, you'll approve the charge and download your full files."}
                </SuccessHint>
            </SuccessWrap>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <OrderRow>
                <div>
                    <OrderLabel>{"Your Character Gallery"}</OrderLabel>
                    <OrderSub>{"One-time · Pre-authorization"}</OrderSub>
                </div>
                <OrderPrice>{"$20"}</OrderPrice>
            </OrderRow>

            <RowLabel>{"Ordering for"}</RowLabel>
            <CustomerBox>
                <Avatar>{"✦"}</Avatar>
                <CustomerInfo>
                    <CustomerName>{name || "—"}</CustomerName>
                    <CustomerEmail>{email || "—"}</CustomerEmail>
                </CustomerInfo>
            </CustomerBox>

            <RowLabel>{"Card details"}</RowLabel>
            <StripeWrap>
                <PaymentElement
                    options={{
                        defaultValues: {
                            billingDetails: { name, email },
                        },
                        layout: "tabs",
                    }}
                />
            </StripeWrap>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <PrimaryCTA
                type="submit"
                $loading={loading}
                $disabled={!stripe || loading}>
                {loading ? "Authorizing…" : "Authorize $20 →"}
            </PrimaryCTA>

            <Fine>
                {"Pre-authorization only — your card is not charged now. You approve the charge after reviewing your gallery."}
            </Fine>
        </form>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Payment() {
    const params = new URLSearchParams(window.location.search);
    const name = decodeURIComponent(params.get("name") ?? "");
    const email = decodeURIComponent(params.get("email") ?? "");

    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        fetch(PAYMENT_INTENT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email }),
        })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data) => {
                if (data?.client_secret) {
                    setClientSecret(data.client_secret);
                } else {
                    setFetchError(`Setup failed: ${JSON.stringify(data)}`);
                }
            })
            .catch((err) =>
                setFetchError(`Could not start checkout: ${err.message}`),
            );
    }, []);

    return (
        <WizardModal backgroundImage={BG} dimOpacity={0.45} maxWidth="540px" align="right">
            <WizardHeader>
                <WizardTitle>{"Apricotter · Character Gallery"}</WizardTitle>
            </WizardHeader>
            <CompactContent>
                {fetchError && <ErrorMsg>{fetchError}</ErrorMsg>}

                {!fetchError && !clientSecret && (
                    <Loading>{"Setting up checkout…"}</Loading>
                )}

                {clientSecret && (
                    <Elements
                        stripe={stripePromise}
                        options={{ clientSecret, appearance: stripeAppearance }}>
                        <CheckoutForm name={name} email={email} />
                    </Elements>
                )}
            </CompactContent>
        </WizardModal>
    );
}
