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
    gap: 14px;
    padding: 0;
    background: var(--secondary-background);
    border: 1px solid var(--tertiary-background);
    border-top: 3px solid var(--accent);
    border-radius: var(--border-radius);
    max-width: 480px;
    overflow: hidden;
`;

const FormTitle = styled.div`
    font-size: 13px;
    font-weight: 700;
    color: var(--foreground);
    padding: 12px 16px 0;
`;

const FormBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 16px 16px;
`;

const FormField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 5px;
`;

const FormLabel = styled.label`
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--secondary-foreground);
    letter-spacing: 0.7px;
`;

const inputBase = `
    padding: 8px 11px;
    border-radius: calc(var(--border-radius) / 1.5);
    background: var(--background);
    border: 1.5px solid var(--tertiary-background);
    color: var(--foreground);
    font-size: 13px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
    &:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(255, 160, 60, 0.12);
    }
    &::placeholder {
        color: var(--tertiary-foreground);
        opacity: 0.7;
    }
`;

const FormInput = styled.input`${inputBase}`;

const FormTextarea = styled.textarea`
    ${inputBase}
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
`;

const FormSelect = styled.select`
    ${inputBase}
    cursor: pointer;
    appearance: auto;
`;

const RadioGroup = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;

const RadioChip = styled.label<{ checked: boolean }>`
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1.5px solid ${p => p.checked ? "var(--accent)" : "var(--tertiary-background)"};
    background: ${p => p.checked ? "rgba(255,160,60,0.12)" : "var(--background)"};
    color: ${p => p.checked ? "var(--accent)" : "var(--secondary-foreground)"};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s, color 0.12s;
    user-select: none;
    input { display: none; }
    &:hover {
        border-color: var(--accent);
        color: var(--accent);
    }
`;

const FormDivider = styled.div`
    height: 1px;
    background: var(--tertiary-background);
    margin: 0 -16px;
    width: calc(100% + 32px);
`;

const QuestionHeader = styled.div`
    font-size: 15px;
    font-weight: 700;
    color: var(--foreground);
    letter-spacing: 0.2px;
`;

const QuestionRule = styled.div`
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
    margin: 4px 0 8px;
    opacity: 0.5;
`;

const QuestionDesc = styled.div`
    font-size: 13px;
    color: var(--secondary-foreground);
    line-height: 1.5;
    margin-bottom: 8px;
`;

const QuestionInput = styled.input`
    ${inputBase}
    font-size: 15px;
    padding: 11px 14px;
    caret-color: var(--accent);
    caret-shape: bar;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(255, 160, 60, 0.1);
    &:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 4px rgba(255, 160, 60, 0.18);
    }
`;

const FormSubmit = styled.button`
    align-self: flex-start;
    padding: 8px 20px;
    border-radius: var(--border-radius);
    background: var(--accent);
    color: #080c18;
    font-size: 13px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    &:hover:not(:disabled) {
        opacity: 0.88;
        transform: translateY(-1px);
    }
    &:active:not(:disabled) {
        transform: translateY(0);
    }
    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
`;

const FormSuccess = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: #4ade80;
    font-weight: 600;
    padding: 10px 16px;
`;

interface OttoFormField {
    type: "text" | "textarea" | "combo" | "radio" | "checkbox" | "file" | "select" | "question";
    key: string;
    field: string;
    description?: string;
    value?: string;
    placeholder?: string;
    options?: string[];
    choices?: string[];
}

interface OttoFormSchema {
    title?: string;
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
        return (
            <FormWrap>
                <FormSuccess>✓ Got it — Otto will continue shortly.</FormSuccess>
            </FormWrap>
        );
    }

    return (
        <FormWrap>
            {schema.title && <FormTitle>{schema.title}</FormTitle>}
            <FormBody>
                {schema.fields.map((field) => field.type === "question" ? (
                    <FormField key={field.key}>
                        <QuestionHeader>{field.field}</QuestionHeader>
                        <QuestionRule />
                        {field.description && <QuestionDesc>{field.description}</QuestionDesc>}
                        <QuestionInput
                            type="text"
                            autoFocus
                            value={values[field.key] ?? ""}
                            placeholder={field.placeholder}
                            onInput={set(field.key)}
                        />
                    </FormField>
                ) : (
                    <FormField key={field.key}>
                        <FormLabel>{field.field}</FormLabel>
                        {field.type === "textarea" ? (
                            <FormTextarea
                                value={values[field.key] ?? ""}
                                placeholder={field.placeholder}
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
                            <RadioGroup>
                                {(field.choices ?? []).map((choice) => (
                                    <RadioChip key={choice} checked={values[field.key] === choice}>
                                        <input
                                            type="radio"
                                            name={field.key}
                                            value={choice}
                                            checked={values[field.key] === choice}
                                            onChange={set(field.key)}
                                        />
                                        {choice}
                                    </RadioChip>
                                ))}
                            </RadioGroup>
                        ) : (
                            <FormInput
                                type="text"
                                value={values[field.key] ?? ""}
                                placeholder={field.placeholder}
                                onInput={set(field.key)}
                            />
                        )}
                    </FormField>
                ))}
                <FormDivider />
                <FormSubmit disabled={sending} onClick={handleSubmit}>
                    {sending ? "Sending..." : (schema.submit ?? "Submit")}
                </FormSubmit>
            </FormBody>
        </FormWrap>
    );
}

const ThinkingDetails = styled.details`
    margin: 4px 0;
    border-radius: var(--border-radius);
    border: 1px solid var(--tertiary-background);
    background: var(--secondary-background);
    font-size: 13px;

    summary {
        padding: 6px 10px;
        cursor: pointer;
        font-weight: 600;
        color: var(--secondary-foreground);
        user-select: none;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 6px;

        &::before {
            content: "▶";
            font-size: 9px;
            transition: transform 0.15s;
        }
    }

    &[open] summary::before {
        transform: rotate(90deg);
    }
`;

const ThinkingBody = styled.div`
    padding: 8px 12px;
    color: var(--tertiary-foreground);
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.5;
    border-top: 1px solid var(--tertiary-background);
`;

function ThinkingBlock({ raw }: { raw: string }) {
    return (
        <ThinkingDetails>
            <summary>Otto's Thoughts</summary>
            <ThinkingBody>{raw.trim()}</ThinkingBody>
        </ThinkingDetails>
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

    // Otto thinking block — collapsible reasoning display
    if (lang === "thinking") {
        return <ThinkingBlock raw={extractText(children)} />;
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
