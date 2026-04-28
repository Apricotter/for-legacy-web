import { observer } from "mobx-react-lite";
import styled from "styled-components/macro";

import { useState } from "preact/hooks";

import { useClient } from "../../../controllers/client/ClientController";

const Title = styled.h1`
    margin-bottom: 20px;
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 480px;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const Label = styled.label`
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--secondary-foreground);
`;

const Input = styled.input`
    padding: 8px 12px;
    border-radius: var(--border-radius);
    background: var(--secondary-background);
    border: 1px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 14px;
    outline: none;

    &:focus {
        border-color: var(--accent);
    }
`;

const Select = styled.select`
    padding: 8px 12px;
    border-radius: var(--border-radius);
    background: var(--secondary-background);
    border: 1px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 14px;
    outline: none;

    &:focus {
        border-color: var(--accent);
    }
`;

const Textarea = styled.textarea`
    padding: 8px 12px;
    border-radius: var(--border-radius);
    background: var(--secondary-background);
    border: 1px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 14px;
    outline: none;
    resize: vertical;
    min-height: 80px;

    &:focus {
        border-color: var(--accent);
    }
`;

const Button = styled.button<{ primary?: boolean }>`
    padding: 10px 20px;
    border-radius: var(--border-radius);
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    background: ${(p) => (p.primary ? "var(--accent)" : "var(--secondary-background)")};
    color: ${(p) => (p.primary ? "white" : "var(--foreground)")};

    &:hover {
        filter: brightness(1.1);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const Actions = styled.div`
    display: flex;
    gap: 10px;
    margin-top: 8px;
`;

const ErrorMsg = styled.div`
    padding: 10px 14px;
    border-radius: var(--border-radius);
    background: var(--error);
    color: white;
    font-size: 13px;
`;

const SuccessBox = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 480px;
`;

const InviteLink = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--secondary-background);
    border-radius: var(--border-radius);
    padding: 10px 14px;
    font-size: 13px;
    font-family: monospace;
    word-break: break-all;
    color: var(--foreground);
`;

const Hint = styled.span`
    font-size: 12px;
    color: var(--secondary-foreground);
`;

const emptyForm = {
    clientName: "",
    clientType: "Author",
    email: "",
    website: "",
    instagram: "",
    google: "",
    notes: "",
};

export default observer(() => {
    const client = useClient();
    const [fields, setFields] = useState(emptyForm);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    function set(key: keyof typeof emptyForm) {
        return (e: Event) =>
            setFields((f) => ({
                ...f,
                [key]: (e.target as HTMLInputElement).value,
            }));
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = (client as any)?.session?.token;
            const apiUrl = import.meta.env.VITE_API_URL ?? "";

            const resp = await fetch(`${apiUrl}/admin/invitations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "X-Session-Token": token } : {}),
                },
                body: JSON.stringify({ max_uses: 1 }),
            });

            if (!resp.ok) {
                const text = await resp.text().catch(() => resp.statusText);
                throw new Error(`${resp.status}: ${text}`);
            }

            const data = await resp.json();
            const code = data.code ?? data._id ?? data.id;
            if (!code) throw new Error("No invite code in response");

            const appUrl =
                import.meta.env.VITE_APP_URL ?? "https://app.apricotter.com";
            setInviteUrl(`${appUrl}/invite/${code}`);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }

    function copyLink() {
        if (!inviteUrl) return;
        navigator.clipboard.writeText(inviteUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    function reset() {
        setFields(emptyForm);
        setInviteUrl(null);
        setError(null);
        setCopied(false);
    }

    if (inviteUrl) {
        return (
            <SuccessBox>
                <Title>Invite created</Title>
                <div>
                    <strong>{fields.clientName}</strong> ({fields.clientType})
                </div>
                <Field>
                    <Label>Invite link</Label>
                    <InviteLink>
                        <span style={{ flex: 1 }}>{inviteUrl}</span>
                        <Button type="button" onClick={copyLink}>
                            {copied ? "Copied!" : "Copy"}
                        </Button>
                    </InviteLink>
                    <Hint>Copy this link and send it to the client.</Hint>
                </Field>
                <Actions>
                    <Button type="button" primary onClick={reset}>
                        Register Another
                    </Button>
                </Actions>
            </SuccessBox>
        );
    }

    return (
        <>
            <Title>New Client</Title>
            <Form onSubmit={handleSubmit}>
                {error && <ErrorMsg>{error}</ErrorMsg>}

                <Field>
                    <Label>Client Name *</Label>
                    <Input
                        type="text"
                        required
                        value={fields.clientName}
                        onInput={set("clientName")}
                        placeholder="Jane Smith"
                    />
                </Field>

                <Field>
                    <Label>Client Type *</Label>
                    <Select
                        required
                        value={fields.clientType}
                        onChange={set("clientType")}>
                        <option value="Author">Author</option>
                        <option value="Home Services">Home Services</option>
                    </Select>
                </Field>

                <Field>
                    <Label>Email Address *</Label>
                    <Input
                        type="email"
                        required
                        value={fields.email}
                        onInput={set("email")}
                        placeholder="client@example.com"
                    />
                </Field>

                <Field>
                    <Label>Website URL</Label>
                    <Input
                        type="text"
                        value={fields.website}
                        onInput={set("website")}
                        placeholder="https://example.com"
                    />
                </Field>

                <Field>
                    <Label>Instagram Handle</Label>
                    <Input
                        type="text"
                        value={fields.instagram}
                        onInput={set("instagram")}
                        placeholder="@handle"
                    />
                </Field>

                <Field>
                    <Label>Google Business</Label>
                    <Input
                        type="text"
                        value={fields.google}
                        onInput={set("google")}
                        placeholder="Business name or URL"
                    />
                </Field>

                <Field>
                    <Label>Notes</Label>
                    <Textarea
                        value={fields.notes}
                        onInput={set("notes")}
                        placeholder="Any context for this client..."
                    />
                </Field>

                <Actions>
                    <Button type="submit" primary disabled={loading}>
                        {loading ? "Creating..." : "Create Invite"}
                    </Button>
                </Actions>
            </Form>
        </>
    );
});
