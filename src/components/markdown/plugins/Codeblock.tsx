import styled from "styled-components";

import { useCallback, useRef, useState } from "preact/hooks";
import { useLocation } from "react-router-dom";

import { Tooltip } from "@revoltchat/ui";

import { modalController } from "../../../controllers/modals/ModalController";
import { useClient } from "../../../controllers/client/ClientController";

/**
 * Base codeblock styles
 */
const Base = styled.pre`
    padding: 1em;
    overflow-x: scroll;
    background: var(--block);
    border-radius: var(--border-radius);
`;

/**
 * Copy codeblock contents button styles
 */
const Lang = styled.div`
    font-family: var(--monospace-font);
    width: fit-content;
    padding-bottom: 8px;

    a {
        color: #111;
        cursor: pointer;
        padding: 2px 6px;
        font-weight: 600;
        user-select: none;
        display: inline-block;
        background: var(--accent);

        font-size: 10px;
        text-transform: uppercase;
        box-shadow: 0 2px #787676;
        border-radius: calc(var(--border-radius) / 3);

        &:active {
            transform: translateY(1px);
            box-shadow: 0 1px #787676;
        }
    }
`;

// --- Otto form block styles ---

const FormWrap = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    background: var(--secondary-background);
    border: 1px solid rgba(255, 160, 60, 0.25);
    border-radius: var(--border-radius);
    max-width: 480px;
`;

const FormField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const FormLabel = styled.label`
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--secondary-foreground);
    letter-spacing: 0.8px;
`;

const FormInput = styled.input`
    padding: 7px 10px;
    border-radius: var(--border-radius);
    background: var(--background);
    border: 1px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 13px;
    outline: none;
    &:focus {
        border-color: var(--accent);
    }
`;

const FormTextarea = styled.textarea`
    padding: 7px 10px;
    border-radius: var(--border-radius);
    background: var(--background);
    border: 1px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 13px;
    outline: none;
    resize: vertical;
    min-height: 70px;
    &:focus {
        border-color: var(--accent);
    }
`;

const FormSelect = styled.select`
    padding: 7px 10px;
    border-radius: var(--border-radius);
    background: var(--background);
    border: 1px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 13px;
    outline: none;
    &:focus {
        border-color: var(--accent);
    }
`;

const FormSubmit = styled.button`
    align-self: flex-start;
    padding: 8px 18px;
    border-radius: var(--border-radius);
    background: var(--accent);
    color: #080c18;
    font-size: 13px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    &:hover {
        opacity: 0.88;
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const FormSuccess = styled.div`
    font-size: 13px;
    color: #4ade80;
    font-weight: 600;
    padding: 4px 0;
`;

interface OttoFormField {
    type: "text" | "textarea" | "combo" | "radio" | "checkbox" | "file" | "select";
    key: string;
    field: string;
    value?: string;
    options?: string[];
    choices?: string[];
}

interface OttoFormSchema {
    fields: OttoFormField[];
    submit?: string;
}

function OttoFormBlock({ raw }: { raw: string }) {
    const client = useClient();
    const location = useLocation();

    let schema: OttoFormSchema;
    try {
        schema = JSON.parse(raw);
    } catch {
        return <Base><code>{raw}</code></Base>;
    }

    const [values, setValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        schema.fields.forEach((f) => { if (f.value) init[f.key] = f.value; });
        return init;
    });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);

    const set = (key: string) => (e: Event) =>
        setValues((v) => ({ ...v, [key]: (e.target as HTMLInputElement).value }));

    async function handleSubmit() {
        if (sending || submitted) return;
        setSending(true);
        try {
            // Extract channel ID from current URL: /server/:sid/channel/:cid or /channel/:cid
            const channelId = location.pathname.match(/\/channel\/([A-Z0-9]{26})/i)?.[1];
            const channel = channelId ? (client as any)?.channels?.get(channelId) : null;
            if (!channel) return;

            const lines = schema.fields
                .filter((f) => values[f.key] !== undefined && values[f.key] !== "")
                .map((f) => `${f.field}: ${values[f.key]}`);

            await channel.sendMessage({ content: lines.join("\n") });
            setSubmitted(true);
        } finally {
            setSending(false);
        }
    }

    if (submitted) {
        return <FormSuccess>✓ Got it — Otto will continue shortly.</FormSuccess>;
    }

    return (
        <FormWrap>
            {schema.fields.map((field) => (
                <FormField key={field.key}>
                    <FormLabel>{field.field}</FormLabel>
                    {field.type === "textarea" ? (
                        <FormTextarea
                            value={values[field.key] ?? ""}
                            onInput={set(field.key)}
                        />
                    ) : field.type === "combo" || field.type === "select" ? (
                        <FormSelect value={values[field.key] ?? ""} onChange={set(field.key)}>
                            <option value="">Select...</option>
                            {(field.options ?? field.choices ?? []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </FormSelect>
                    ) : field.type === "radio" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {(field.choices ?? []).map((choice) => (
                                <label key={choice} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                    <input
                                        type="radio"
                                        name={field.key}
                                        value={choice}
                                        checked={values[field.key] === choice}
                                        onChange={set(field.key)}
                                    />
                                    {choice}
                                </label>
                            ))}
                        </div>
                    ) : (
                        <FormInput
                            type="text"
                            value={values[field.key] ?? ""}
                            onInput={set(field.key)}
                        />
                    )}
                </FormField>
            ))}
            <FormSubmit disabled={sending} onClick={handleSubmit}>
                {sending ? "Sending..." : (schema.submit ?? "Submit")}
            </FormSubmit>
        </FormWrap>
    );
}

function extractText(node: any): string {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node?.props?.children) return extractText(node.props.children);
    return "";
}

/**
 * Render a codeblock with copy text button, or an Otto form block
 */
export const RenderCodeblock: React.FC<{ class: string }> = ({
    children,
    ...props
}) => {
    const ref = useRef<HTMLPreElement>(null);

    let lang = "text";
    if (props.class) {
        lang = props.class.split("-")[1];
    }

    // Otto interactive form block
    if (lang === "form") {
        return <OttoFormBlock raw={extractText(children)} />;
    }

    const onCopy = useCallback(() => {
        const text = ref.current?.querySelector("code")?.innerText;
        text && modalController.writeText(text);
    }, [ref]);

    return (
        <Base ref={ref}>
            <Lang>
                <Tooltip content="Copy to Clipboard" placement="top">
                    {/**
                    // @ts-expect-error Preact-React */}
                    <a onClick={onCopy}>{lang}</a>
                </Tooltip>
            </Lang>
            {children}
        </Base>
    );
};
