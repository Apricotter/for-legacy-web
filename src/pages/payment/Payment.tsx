import { useEffect, useState } from "preact/hooks";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import styled from "styled-components/macro";
import { CreditCard } from "@styled-icons/boxicons-regular";
import { Paypal } from "@styled-icons/simple-icons";

import {
    WizardModal,
    WizardHeader,
    WizardTitle,
    WizardContent,
} from "../../components/shared/WizardModal";
import { PrimaryCTA } from "../../components/shared/PrimaryCTA";

const CompactContent = styled(WizardContent)`
    padding: 8px 18px 10px;
`;

const stripePromise = loadStripe(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string,
);

const PAYMENT_INTENT_URL = "/api/payment-intent";
const BG = "/assets/web/bg-gallery-payment.png";

const elementStyle = {
    style: {
        base: {
            color: "#f0e8d8",
            fontFamily: "Inter, -apple-system, sans-serif",
            fontSize: "13px",
            fontSmoothing: "antialiased",
            "::placeholder": { color: "rgba(240,232,216,0.35)" },
        },
        invalid: { color: "#ff6b6b" },
    },
};

// ── Styled helpers ────────────────────────────────────────────────────────────

const OrderTitle = styled.div`
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.88);
    margin-bottom: 14px;
`;

const CustomerRow = styled.div`
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
`;

const CustomerCol = styled.div`
    flex: 1;
    min-width: 0;
`;

const FieldLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(255, 255, 255, 0.32);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 5px;
`;


const TextInput = styled.input`
    width: 100%;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    color: #f0e8d8;
    font-size: 13px;
    font-family: Inter, -apple-system, sans-serif;
    padding: 7px 11px;
    outline: none;
    box-sizing: border-box;
    &:focus {
        border-color: rgba(244, 185, 120, 0.55);
        box-shadow: 0 0 0 3px rgba(244, 185, 120, 0.12);
    }
    &::placeholder { color: rgba(240, 232, 216, 0.35); }
`;

const PayTabRow = styled.div`
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
`;

const PayTab = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid ${p => p.$active ? "rgba(244,185,120,0.5)" : "rgba(255,255,255,0.1)"};
    background: ${p => p.$active ? "rgba(244,185,120,0.1)" : "rgba(255,255,255,0.04)"};
    color: ${p => p.$active ? "#f4b978" : "rgba(240,232,216,0.5)"};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    &:hover {
        border-color: rgba(244, 185, 120, 0.35);
        color: rgba(244, 185, 120, 0.8);
    }
`;

const CardGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
`;

const StripeFieldWrap = styled.div<{ $focused?: boolean }>`
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid ${p => p.$focused ? "rgba(244,185,120,0.55)" : "rgba(255,255,255,0.14)"};
    border-radius: 8px;
    padding: 9px 11px;
    transition: border-color 0.15s, box-shadow 0.15s;
    ${p => p.$focused ? "box-shadow: 0 0 0 3px rgba(244,185,120,0.12);" : ""}
`;

const PayPalNote = styled.div`
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
    padding: 18px 0 10px;
    line-height: 1.6;
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

const Loading = styled.div`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 20px 0;
`;

const Disclaimer = styled.div`
    display: flex;
    gap: 10px;
    padding: 10px 13px;
    background: rgba(244, 185, 120, 0.06);
    border: 1px solid rgba(244, 185, 120, 0.18);
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.52);
    line-height: 1.55;

    strong { color: rgba(255, 255, 255, 0.75); font-weight: 600; }
`;

const DisclaimerIcon = styled.div`
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 1px;
    color: rgba(244, 185, 120, 0.6);
`;

const CheckboxRow = styled.label`
    display: flex;
    align-items: flex-start;
    gap: 9px;
    cursor: pointer;
    margin-bottom: 12px;
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.5;

    input[type="checkbox"] {
        margin-top: 2px;
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        accent-color: #f4b978;
        cursor: pointer;
    }
`;

const TcLink = styled.a`
    color: #f4b978;
    text-decoration: underline;
    text-underline-offset: 2px;
    opacity: 0.85;
    transition: opacity 0.15s;
    &:hover { opacity: 1; }
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

// ── Checkout form ─────────────────────────────────────────────────────────────

function CheckoutForm({
    initialName,
    initialEmail,
    clientSecret,
}: {
    initialName: string;
    initialEmail: string;
    clientSecret: string;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [payMethod, setPayMethod] = useState<"card" | "paypal">("card");
    const [localName, setLocalName] = useState(initialName);
    const [localEmail, setLocalEmail] = useState(initialEmail);
    const [zip, setZip] = useState("");
    const [focused, setFocused] = useState<string | null>(null);
    const [agreed, setAgreed] = useState(false);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        if (!stripe) return;
        setLoading(true);
        setError(null);

        if (payMethod === "card") {
            if (!elements) { setLoading(false); return; }
            const cardElement = elements.getElement(CardNumberElement);
            if (!cardElement) { setLoading(false); return; }

            const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: localName,
                        email: localEmail,
                        address: { postal_code: zip, country: "US" },
                    },
                },
            });

            if (confirmError) {
                setError(confirmError.message ?? "Payment failed.");
                setLoading(false);
                return;
            }
        } else {
            // PayPal: create a separate PI (no manual capture) then redirect
            let paypalSecret: string | null = null;
            try {
                const res = await fetch(PAYMENT_INTENT_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: localName, email: localEmail, paymentMethod: "paypal" }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
                paypalSecret = data.client_secret ?? null;
            } catch (err: any) {
                setError(`PayPal unavailable: ${err.message}`);
                setLoading(false);
                return;
            }

            if (!paypalSecret) {
                setError("Could not initialize PayPal.");
                setLoading(false);
                return;
            }

            // confirmPayPalPayment redirects the browser to PayPal
            const { error: confirmError } = await (stripe as any).confirmPayPalPayment(paypalSecret, {
                return_url: `${window.location.origin}/gallery/confirmed`,
            });

            if (confirmError) {
                setError(confirmError.message ?? "PayPal payment failed.");
                setLoading(false);
                return;
            }
            return; // redirect in progress
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
                    <strong>{localEmail}</strong>
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
            <OrderTitle>{"Your Character Gallery"}</OrderTitle>

            {/* Name + Email — side by side inputs, pre-filled from URL */}
            <CustomerRow>
                <CustomerCol>
                    <FieldLabel>{"Name"}</FieldLabel>
                    <TextInput
                        value={localName}
                        onInput={(e) => setLocalName((e.target as HTMLInputElement).value)}
                        placeholder="Full name"
                    />
                </CustomerCol>
                <CustomerCol>
                    <FieldLabel>{"Email"}</FieldLabel>
                    <TextInput
                        value={localEmail}
                        onInput={(e) => setLocalEmail((e.target as HTMLInputElement).value)}
                        placeholder="Email address"
                        type="email"
                    />
                </CustomerCol>
            </CustomerRow>

            {/* Payment method tabs */}
            <PayTabRow>
                <PayTab type="button" $active={payMethod === "card"} onClick={() => setPayMethod("card")}>
                    <CreditCard size={15} />
                    {"Card"}
                </PayTab>
                <PayTab type="button" $active={payMethod === "paypal"} onClick={() => setPayMethod("paypal")}>
                    <Paypal size={13} />
                    {"PayPal"}
                </PayTab>
            </PayTabRow>

            {/* Card fields — 2×2 grid */}
            {payMethod === "card" && (
                <CardGrid>
                    <div>
                        <FieldLabel>{"Card number"}</FieldLabel>
                        <StripeFieldWrap $focused={focused === "cardNumber"}>
                            <CardNumberElement
                                options={elementStyle}
                                onFocus={() => setFocused("cardNumber")}
                                onBlur={() => setFocused(null)}
                            />
                        </StripeFieldWrap>
                    </div>
                    <div>
                        <FieldLabel>{"Expiry"}</FieldLabel>
                        <StripeFieldWrap $focused={focused === "expiry"}>
                            <CardExpiryElement
                                options={elementStyle}
                                onFocus={() => setFocused("expiry")}
                                onBlur={() => setFocused(null)}
                            />
                        </StripeFieldWrap>
                    </div>
                    <div>
                        <FieldLabel>{"Zip code"}</FieldLabel>
                        <TextInput
                            value={zip}
                            onInput={(e) => setZip((e.target as HTMLInputElement).value)}
                            placeholder="10001"
                            maxLength={10}
                        />
                    </div>
                    <div>
                        <FieldLabel>{"Security code"}</FieldLabel>
                        <StripeFieldWrap $focused={focused === "cvc"}>
                            <CardCvcElement
                                options={elementStyle}
                                onFocus={() => setFocused("cvc")}
                                onBlur={() => setFocused(null)}
                            />
                        </StripeFieldWrap>
                    </div>
                </CardGrid>
            )}

            {payMethod === "paypal" && (
                <PayPalNote>
                    {"You'll be redirected to PayPal to complete your $20 pre-authorization."}
                </PayPalNote>
            )}

            <Disclaimer>
                <DisclaimerIcon>{"ⓘ"}</DisclaimerIcon>
                <div>
                    <strong>{"Your card will not be charged today."}</strong>
                    {" This is a pre-authorization hold only. We use it to secure your spot while Otto prepares your character gallery. You'll review watermarked previews first — and only approve the $20 charge if you want to unlock and download your full package."}
                </div>
            </Disclaimer>

            <CheckboxRow>
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed((e.target as HTMLInputElement).checked)}
                />
                {"I agree to the "}
                <TcLink href="/docs/terms-of-service.pdf" target="_blank" rel="noopener noreferrer">
                    {"Terms of Service"}
                </TcLink>
                {" and "}
                <TcLink href="/docs/privacy-policy.pdf" target="_blank" rel="noopener noreferrer">
                    {"Privacy Policy"}
                </TcLink>
                {"."}
            </CheckboxRow>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <PrimaryCTA
                type="submit"
                $loading={loading}
                $disabled={!stripe || loading || !agreed}>
                {loading ? "Authorizing…" : "Authorize →"}
            </PrimaryCTA>
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
        <WizardModal backgroundImage={BG} dimOpacity={0.45} maxWidth="620px" align="right">
            <WizardHeader>
                <WizardTitle>{"Apricotter · Character Gallery"}</WizardTitle>
            </WizardHeader>
            <CompactContent>
                {fetchError && <ErrorMsg>{fetchError}</ErrorMsg>}

                {!fetchError && !clientSecret && (
                    <Loading>{"Setting up checkout…"}</Loading>
                )}

                {clientSecret && (
                    <Elements stripe={stripePromise}>
                        <CheckoutForm
                            initialName={name}
                            initialEmail={email}
                            clientSecret={clientSecret}
                        />
                    </Elements>
                )}
            </CompactContent>
        </WizardModal>
    );
}
