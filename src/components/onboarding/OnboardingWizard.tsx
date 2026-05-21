import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import styled from "styled-components/macro";

import { uploadFile } from "../../controllers/client/jsx/legacy/FileUploads";
import { useClient } from "../../controllers/client/ClientController";
import { ModalProps } from "../../controllers/modals/types";

import SubwayMap from "./SubwayMap";
import { useOnboardingMessages, WizardStep } from "./useOnboardingMessages";

// ── overlay ───────────────────────────────────────────────────────────────────

const Overlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
        content: "";
        position: absolute;
        inset: 0;
        background: url("/assets/web/bg-library.webp") center / cover no-repeat;
        transform: scaleX(-1);
        z-index: 0;
    }
    &::after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(8, 5, 1, 0.72);
        z-index: 1;
    }
`;

const Shell = styled.div`
    position: relative;
    z-index: 2;
    background: rgba(14, 8, 2, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-top: 1px solid rgba(244, 185, 120, 0.35);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-radius: 20px;
    width: min(600px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0,0,0,0.4);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 22px 0;
`;

const WizardTitle = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: #F5A623;
    text-transform: uppercase;
    letter-spacing: 0.14em;
`;

const CloseBtn = styled.button`
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.9); }
`;

const ResetBtn = styled.button<{ $resetting?: boolean }>`
    background: none;
    border: none;
    color: rgba(255,255,255,0.35);
    font-size: 11px;
    cursor: ${p => p.$resetting ? "wait" : "pointer"};
    padding: 0;
    text-decoration: underline;
    opacity: ${p => p.$resetting ? 0.5 : 1};
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.65); }
`;

const Content = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 22px 26px 26px;
    min-height: 180px;
    color: rgba(255,255,255,0.92);

    p, h1, h2, h3, h4 {
        color: rgba(255,255,255,0.92);
    }
`;

const ModalWrapper = styled.div`
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
`;

const DomeBtn = styled.button<{ $side: "left" | "right" }>`
    position: absolute;
    ${p => p.$side === "left" ? "right: 100%;" : "left: 100%;"}
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 80px;
    background: rgba(245, 166, 35, 0.15);
    border: 1px solid rgba(245, 166, 35, 0.45);
    ${p => p.$side === "left"
        ? "border-radius: 40px 0 0 40px; border-right: none;"
        : "border-radius: 0 40px 40px 0; border-left: none;"}
    color: #F5A623;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 0;
    box-shadow: 0 0 16px rgba(245, 166, 35, 0.22);
    &:hover {
        background: rgba(245, 166, 35, 0.28);
        color: #fff;
        box-shadow: 0 4px 22px rgba(245, 166, 35, 0.5);
    }
`;


// ── step content ──────────────────────────────────────────────────────────────

// Greeting
const GreetTitle = styled.div`
    font-size: 24px;
    font-weight: 800;
    color: rgba(255,255,255,0.95);
    margin-bottom: 8px;
    letter-spacing: -0.02em;
`;
const GreetDesc = styled.div`
    font-size: 14px;
    color: rgba(255,255,255,0.82);
    line-height: 1.65;
    margin-bottom: 20px;
`;
const GreetSteps = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    overflow: hidden;
`;
const GreetStep = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 13px;
    color: rgba(255,255,255,0.65);
    padding: 11px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    &:last-child { border-bottom: none; }
`;
const GreetNum = styled.div`
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(245, 166, 35, 0.18);
    border: 1px solid rgba(245, 166, 35, 0.45);
    color: #F5A623;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

// Form
const FormTitle = styled.div`
    font-size: 18px;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    margin-bottom: 18px;
    letter-spacing: -0.01em;
`;
const FormField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
`;
const FormLabel = styled.label`
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    letter-spacing: 0.07em;
`;
const FormInput = styled.input`
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.92);
    font-size: 14px;
    padding: 9px 13px;
    outline: none;
    transition: border-color 0.15s;
    &::placeholder { color: rgba(255,255,255,0.28); }
    &:focus { border-color: #F4B978; }
`;
const FormTextarea = styled.textarea`
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.92);
    font-size: 14px;
    padding: 9px 13px;
    outline: none;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s;
    &::placeholder { color: rgba(255,255,255,0.28); }
    &:focus { border-color: #F4B978; }
`;
const FormSelect = styled.select`
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.92);
    font-size: 14px;
    padding: 9px 13px;
    outline: none;
`;
const UploadZone = styled.div<{ $dragging: boolean; $hasFile: boolean }>`
    border: 1px dashed ${p => p.$hasFile || p.$dragging ? "#F5A623" : "rgba(245,166,35,0.45)"};
    border-radius: 12px;
    padding: 32px 24px 28px;
    text-align: center;
    cursor: pointer;
    background: ${p =>
        p.$hasFile  ? "rgba(245,166,35,0.09)" :
        p.$dragging ? "rgba(245,166,35,0.12)" :
        "rgba(245,166,35,0.04)"};
    transition: border-color 0.15s, background 0.15s;
    &:hover { border-color: #F5A623; background: rgba(245,166,35,0.08); }
`;

const UploadCta = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #F5A623;
    color: #1a0e00;
    font-size: 13px;
    font-weight: 700;
    padding: 8px 20px;
    border-radius: 7px;
    margin-top: 14px;
    letter-spacing: 0.01em;
    box-shadow: 0 3px 14px rgba(245,166,35,0.4);
    pointer-events: none;
`;
const SubmitBtn = styled.button<{ $sending?: boolean; $disabled?: boolean }>`
    background: ${p => p.$disabled ? "rgba(245,166,35,0.25)" : p.$sending ? "rgba(245,166,35,0.6)" : "#F5A623"};
    color: ${p => p.$disabled ? "rgba(255,255,255,0.3)" : "#1a0e00"};
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 0;
    width: 100%;
    cursor: ${p => p.$disabled ? "not-allowed" : p.$sending ? "wait" : "pointer"};
    margin-top: 8px;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    letter-spacing: 0.02em;
    box-shadow: ${p => p.$disabled ? "none" : "0 4px 20px rgba(245, 166, 35, 0.35)"};
    &:hover:not([disabled]) {
        background: ${p => p.$disabled ? undefined : "#f9b830"};
        box-shadow: ${p => p.$disabled ? "none" : "0 6px 28px rgba(245, 166, 35, 0.5)"};
    }
    &:active { transform: ${p => p.$disabled ? "none" : "scale(0.99)"}; }
`;
// Star rating
const StarRow = styled.div`
    display: flex;
    gap: 6px;
    margin-top: 2px;
`;
const StarBtn = styled.button<{ $active: boolean }>`
    background: none;
    border: none;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    color: ${p => p.$active ? "#F5A623" : "rgba(255,255,255,0.18)"};
    transition: color 0.12s, transform 0.1s;
    &:hover { color: #F5A623; transform: scale(1.15); }
`;
const SecondaryBtn = styled.button`
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    color: rgba(255,255,255,0.55);
    font-size: 14px;
    font-weight: 600;
    padding: 12px 0;
    flex: 1;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    &:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.85); }
`;

const ConfirmCard = styled.div`
    border: 1px solid rgba(245, 166, 35, 0.22);
    border-radius: 14px;
    background: rgba(245, 166, 35, 0.06);
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;
const ConfirmIcon = styled.div`
    font-size: 28px;
    line-height: 1;
    margin-bottom: 4px;
`;
const ConfirmHeading = styled.div`
    font-size: 18px;
    font-weight: 800;
    color: rgba(255,255,255,0.92);
    letter-spacing: -0.01em;
`;
const ConfirmBody = styled.div`
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    line-height: 1.65;
    margin-bottom: 6px;
`;

// Checkpoint
const CheckpointTitle = styled.div`
    font-size: 18px;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    margin-bottom: 6px;
    letter-spacing: -0.01em;
`;
const CheckpointSub = styled.div`
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    margin-bottom: 18px;
    line-height: 1.5;
`;
const CharGroup = styled.div`
    margin-bottom: 14px;
`;
const CharGroupLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin-bottom: 7px;
`;
const CharList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;
const CharChip = styled.div<{ $role?: "Main" | "Supporting" | "Minor" }>`
    background: ${p =>
        p.$role === "Main"       ? "rgba(244,185,120,0.12)" :
        p.$role === "Supporting" ? "rgba(96,165,250,0.10)"  :
        "rgba(255,255,255,0.05)"};
    border: 1px solid ${p =>
        p.$role === "Main"       ? "rgba(244,185,120,0.4)" :
        p.$role === "Supporting" ? "rgba(96,165,250,0.35)"  :
        "rgba(255,255,255,0.1)"};
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 13px;
    color: ${p =>
        p.$role === "Main"       ? "#F4B978" :
        p.$role === "Supporting" ? "#93c5fd"  :
        "rgba(255,255,255,0.6)"};
`;
const CharScrollList = styled.div`
    max-height: 210px;
    overflow-y: auto;
    margin: 14px 0;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 4px 0;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
`;
const CharRow = styled.label`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    &:last-child { border-bottom: none; }
    &:hover { background: rgba(255,255,255,0.03); }
`;
const CharRowName = styled.span`
    font-size: 13px;
    color: rgba(255,255,255,0.85);
    flex: 1;
`;
const CharRoleTag = styled.span<{ $role: string }>`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${p =>
        p.$role === "Main"       ? "#F4B978" :
        p.$role === "Supporting" ? "#93c5fd"  :
        "rgba(255,255,255,0.3)"};
`;
const CheckpointActions = styled.div`
    display: flex;
    gap: 10px;
    margin-top: 4px;
`;
const ConfirmBtn = styled.button`
    background: rgba(101, 229, 114, 0.12);
    color: var(--success);
    border: 1px solid rgba(101, 229, 114, 0.35);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 22px;
    cursor: pointer;
    flex: 1;
    transition: background 0.15s;
    &:hover { background: rgba(101, 229, 114, 0.2); }
`;

// Processing
const ProcessWrap = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    color: rgba(255,255,255,0.55);
    font-size: 14px;
    padding: 8px 0;
`;
const Spinner = styled.div`
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.12);
    border-top-color: #F4B978;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    @keyframes spin { to { transform: rotate(360deg); } }
    flex-shrink: 0;
`;

const EmptyState = styled.div`
    color: rgba(255,255,255,0.32);
    font-size: 14px;
    text-align: center;
    padding: 32px 0;
`;

const PipelineBar = styled.div<{ $active: boolean; $progress: number }>`
    height: 3px;
    flex-shrink: 0;
    overflow: hidden;
    background: rgba(245,166,35,0.08);
    opacity: ${p => p.$active ? 1 : 0};
    transition: opacity 0.6s ease;
    position: relative;
    &::after {
        content: "";
        position: absolute;
        left: 0; top: 0;
        height: 100%;
        width: ${p => Math.round(p.$progress * 100)}%;
        background: linear-gradient(90deg, #e8921acc, #F5A623);
        transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
`;

// ── step renderers ────────────────────────────────────────────────────────────

function GreetingStep({ data, channelId, onDone, prefillName }: { data: any; channelId: string; onDone: (name: string) => void; prefillName?: string }) {
    const client = useClient();
    const [name, setName] = useState<string>(prefillName || data?.prefill_name || "");
    const [sending, setSending] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (prefillName && !name) setName(prefillName);
    }, [prefillName]);

    useEffect(() => {
        const t = setTimeout(() => nameRef.current?.focus(), 400);
        return () => clearTimeout(t);
    }, []);

    const canStart = name.trim().length > 0;

    async function handleStart() {
        if (!canStart || sending) return;
        setSending(true);
        try {
            const ch = (client as any)?.channels?.get(channelId);
            await ch?.sendMessage({ content: `My name is ${name.trim()}` });
        } catch {
            // non-fatal — still advance
        } finally {
            setSending(false);
            onDone(name.trim());
        }
    }

    return (
        <div>
            <GreetTitle>{data?.title ?? "Welcome to your studio"}</GreetTitle>

            {Array.isArray(data?.steps) && data.steps.length > 0 && (
                <>
                    <GreetDesc>We're going to get you set up in {data.steps.length} easy steps</GreetDesc>
                    <GreetSteps style={{ marginBottom: 20 }}>
                        {data.steps.map((s: string, i: number) => (
                            <GreetStep key={i}>
                                <GreetNum>{i + 1}</GreetNum>
                                <span>{s}</span>
                            </GreetStep>
                        ))}
                    </GreetSteps>
                </>
            )}

            <div style={{ marginBottom: 20 }}>
                <FormLabel as="div" style={{ marginBottom: 6 }}>What should we call you?</FormLabel>
                <FormInput
                    ref={nameRef}
                    type="text"
                    value={name}
                    placeholder="Your name"
                    onInput={(e: Event) => setName((e.target as HTMLInputElement).value)}
                    style={{ fontSize: 16, width: "100%" }}
                />
            </div>

            <SubmitBtn $sending={sending} $disabled={!canStart} onClick={handleStart}>
                {sending ? "Starting…" : "Get Started"}
            </SubmitBtn>
        </div>
    );
}

function FormStep({
    step,
    channelId,
    onDone,
    onSkip,
}: {
    step: WizardStep;
    channelId: string;
    onDone: (values?: Record<string, string>) => void;
    onSkip?: () => void;
}) {
    const client = useClient();
    const schema = step.data;

    const [values, setValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        (schema?.fields ?? []).forEach((f: any) => { if (f.value) init[f.key] = f.value; });
        return init;
    });
    const [uploadFile_, setUploadFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [sending, setSending] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const set = (key: string) => (e: Event) =>
        setValues(v => ({ ...v, [key]: (e.target as HTMLInputElement).value }));

    const hasUploadField = (schema?.fields ?? []).some((f: any) => f.type === "upload" || f.type === "file");
    const hasRadioField  = (schema?.fields ?? []).some((f: any) => f.type === "radio");
    const radioFilled    = !hasRadioField || (schema?.fields ?? []).filter((f: any) => f.type === "radio").every((f: any) => !!values[f.key]);
    const canSubmit = (!hasUploadField || !!uploadFile_) && radioFilled;

    async function handleSubmit() {
        if (sending || submitted || !canSubmit) return;
        setSending(true);
        try {
            const ch = (client as any)?.channels?.get(channelId);
            if (!ch) return;

            const attachmentIds: string[] = [];
            if (uploadFile_) {
                const autumnUrl = (client as any)?.configuration?.features?.autumn?.url as string | undefined;
                if (autumnUrl) {
                    const id = await uploadFile(autumnUrl, "attachments", uploadFile_, {});
                    if (id) attachmentIds.push(id);
                }
            }

            const lines = (schema?.fields ?? [])
                .filter((f: any) => f.type !== "upload" && f.type !== "file" && values[f.key])
                .map((f: any) => `${f.field}: ${values[f.key]}`);

            await ch.sendMessage({
                content: lines.join("\n") || undefined,
                attachments: attachmentIds.length > 0 ? attachmentIds : undefined,
            });
            setSubmitted(true);
            onDone(values);
        } finally {
            setSending(false);
        }
    }

    if (submitted) {
        return null; // wizard-level handles what comes next
    }

    return (
        <div>
            {schema?.title && <FormTitle>{schema.title}</FormTitle>}
            {(schema?.fields ?? []).map((field: any) => (
                <FormField key={field.key}>
                    <FormLabel>{field.field}</FormLabel>
                    {field.type === "upload" || field.type === "file" ? (
                        <UploadZone
                            $dragging={dragging}
                            $hasFile={!!uploadFile_}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={e => {
                                e.preventDefault();
                                setDragging(false);
                                const f = e.dataTransfer?.files?.[0];
                                if (f) setUploadFile(f);
                            }}
                            onClick={() => {
                                const inp = document.createElement("input");
                                inp.type = "file";
                                inp.accept = field.accept ?? ".pdf,.epub,.txt";
                                inp.onchange = ev => {
                                    const f = (ev.target as HTMLInputElement).files?.[0];
                                    if (f) setUploadFile(f);
                                };
                                inp.click();
                            }}
                        >
                            {uploadFile_ ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                                    <div style={{ fontSize: 28, lineHeight: 1 }}>📖</div>
                                    <div style={{ color: "#F5A623", fontWeight: 700, fontSize: 14 }}>✓ &nbsp;{uploadFile_.name}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Click to change</div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                                    <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)", fontSize: 15 }}>Let's start with your book</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 2 }}>Drop it here or browse — PDF, EPUB or TXT</div>
                                    <UploadCta>Upload Book</UploadCta>
                                </div>
                            )}
                        </UploadZone>
                    ) : field.type === "radio" ? (
                        <StarRow>
                            {(field.choices ?? field.options ?? []).map((choice: string) => {
                                const n = parseInt(choice);
                                const selected = parseInt(values[field.key] || "0");
                                return (
                                    <StarBtn
                                        key={choice}
                                        $active={n <= selected}
                                        onClick={() => setValues(v => ({ ...v, [field.key]: choice }))}
                                        type="button"
                                    >
                                        {n <= selected ? "★" : "☆"}
                                    </StarBtn>
                                );
                            })}
                        </StarRow>
                    ) : field.type === "textarea" ? (
                        <FormTextarea
                            value={values[field.key] ?? ""}
                            placeholder={field.placeholder}
                            onInput={set(field.key)}
                        />
                    ) : field.type === "date" ? (
                        <FormInput
                            type="date"
                            value={values[field.key] ?? ""}
                            onInput={set(field.key)}
                            style={{ colorScheme: "dark" }}
                        />
                    ) : field.type === "select" || field.type === "combo" ? (
                        <FormSelect value={values[field.key] ?? ""} onChange={set(field.key)}>
                            <option value="">Select...</option>
                            {(field.options ?? field.choices ?? []).map((o: string) => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </FormSelect>
                    ) : field.type === "text" || field.type === "input" ? (
                        <FormInput
                            type="text"
                            value={values[field.key] ?? ""}
                            placeholder={field.placeholder ?? ""}
                            onInput={set(field.key)}
                        />
                    ) : null}
                </FormField>
            ))}
            {onSkip ? (
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <SecondaryBtn onClick={onSkip}>Skip</SecondaryBtn>
                    <SubmitBtn $sending={sending} $disabled={!canSubmit} style={{ flex: 1 }} onClick={handleSubmit}>
                        {sending ? "Sending…" : (schema?.submit ?? "Submit")}
                    </SubmitBtn>
                </div>
            ) : (
                <SubmitBtn $sending={sending} $disabled={!canSubmit} onClick={handleSubmit}>
                    {sending ? "Sending…" : (schema?.submit ?? "Submit")}
                </SubmitBtn>
            )}
        </div>
    );
}

function CheckpointStep({
    step,
    channelId,
    onDone,
}: {
    step: WizardStep;
    channelId: string;
    onDone: () => void;
}) {
    const client = useClient();
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(step.done);

    const data = step.data;
    const advanceUrl: string | undefined = data?.advance_url;

    async function handleConfirm() {
        if (confirming || confirmed) return;
        setConfirming(true);
        try {
            if (advanceUrl) {
                await fetch(advanceUrl, { method: "POST" });
            } else {
                const ch = (client as any)?.channels?.get(channelId);
                await ch?.sendMessage({ content: "confirmed" });
            }
            setConfirmed(true);
            onDone();
        } catch {
            // ignore — let user retry
        } finally {
            setConfirming(false);
        }
    }

    if (confirmed) {
        return (
            <ConfirmCard>
                <ConfirmIcon>✓</ConfirmIcon>
                <ConfirmHeading>Confirmed</ConfirmHeading>
                <ConfirmBody>Pipeline continuing to the next stage.</ConfirmBody>
            </ConfirmCard>
        );
    }

    type CharEntry = { name: string; role: "Main" | "Supporting" | "Minor" };
    const allChars: CharEntry[] = (data?.characters ?? [])
        .filter((c: any) => c.role !== "Background")
        .map((c: any) => ({ name: c.name as string, role: c.role as "Main" | "Supporting" | "Minor" }));

    const [checked, setChecked] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(allChars.map(c => [c.name, true]))
    );
    const toggle = (name: string) => setChecked(prev => ({ ...prev, [name]: !prev[name] }));

    return (
        <div>
            <CheckpointTitle>Please confirm your Cast</CheckpointTitle>
            <CheckpointSub>
                {allChars.length} characters identified. Uncheck anyone who shouldn't be included.
            </CheckpointSub>

            <CharScrollList>
                {allChars.map(({ name, role }) => (
                    <CharRow key={name}>
                        <input
                            type="checkbox"
                            checked={checked[name] ?? true}
                            onChange={() => toggle(name)}
                            style={{ accentColor: "#65E572", cursor: "pointer", flexShrink: 0 }}
                        />
                        <CharRowName>{name}</CharRowName>
                        <CharRoleTag $role={role}>{role}</CharRoleTag>
                    </CharRow>
                ))}
            </CharScrollList>

            <CheckpointActions>
                <ConfirmBtn onClick={handleConfirm} disabled={confirming}>
                    {confirming ? "Confirming…" : "Looks good →"}
                </ConfirmBtn>
            </CheckpointActions>
        </div>
    );
}

function ProcessingStep({ data }: { data: any }) {
    return (
        <ProcessWrap>
            <Spinner />
            <span>{data?.label ?? "Processing…"}</span>
        </ProcessWrap>
    );
}

// ── state machine ─────────────────────────────────────────────────────────────

type Stage = "greeting" | "upload" | "upload_done" | "checkpoint" | "reviews" | "done";

const OTTO_API = "https://otto.apricotter.com";

export default function OnboardingWizard({
    channelId,
    serverId,
    onClose,
}: ModalProps<"author_onboarding">) {
    const client = useClient();
    const { steps, markDone, patchStepData, clearSteps } = useOnboardingMessages(channelId);
    const [stage, setStage] = useState<Stage>("greeting");
    const [resetting, setResetting] = useState(false);
    const [reviewsDone, setReviewsDone] = useState(false);
    const [reviewKey, setReviewKey] = useState(0);
    const [profile, setProfile] = useState<any>(null);
    const [invitationName, setInvitationName] = useState<string>("");
    const [localReviewCount, setLocalReviewCount] = useState(0);
    const stageRestored = useRef(false);
    const profileEpoch  = useRef(0);

    // Fetch invitation metadata to prefill author name on greeting step
    useEffect(() => {
        const apiUrl = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/$/, "");
        const token = (client as any)?.session?.token;
        if (!token) return;
        fetch(`${apiUrl}/users/@me/invitation`, {
            headers: { "x-session-token": token },
        })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(inv => {
                if (!inv?.metadata) return;
                const raw = inv.metadata.name ?? inv.metadata.ownerName ?? "";
                const name = raw.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                if (name) setInvitationName(name);
            });
    }, []);

    // Load profile from Mongo on mount — drives stage restoration and field prefill
    useEffect(() => {
        if (!serverId) return;
        const epoch = profileEpoch.current;
        fetch(`${OTTO_API}/onboarding/${serverId}/profile`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(p => {
                if (profileEpoch.current !== epoch) return; // stale — reset happened while fetching
                if (!p) return;
                setProfile(p);
                if (p.reviews?.length > 0) setLocalReviewCount(p.reviews.length);
                stageRestored.current = true;
                if (p.reviews?.length > 0) {
                    setStage("done");
                } else if (p.bookFilename) {
                    setStage("upload_done");
                } else if (p.authorName) {
                    setStage("upload");
                }
            });
    }, [serverId]);

    // Step selectors — fixed steps always exist; data === null means not yet activated
    const greetingStep      = steps.find(s => s.id === "greeting");
    const uploadStep        = steps.find(s => s.id === "form_book");
    const reviewStep        = steps.find(s => s.id === "form_author");
    const activeCheckpoint  = steps.find(s => s.type === "checkpoint" && s.needsAction && !s.done);

    // Restore stage from history on first load
    useEffect(() => {
        if (steps.length === 0 || stageRestored.current) return;
        stageRestored.current = true;
        if (uploadStep?.done) {
            setStage(reviewStep?.done ? "done" : "reviews");
        } else if (greetingStep?.done) {
            setStage("upload");
        }
    }, [steps.length]);

    // Auto-transition to checkpoint when one becomes active
    useEffect(() => {
        if (activeCheckpoint && stage === "upload_done") setStage("checkpoint");
    }, [activeCheckpoint?.id]);

    const handleReset = useCallback(async () => {
        if (resetting) return;
        setResetting(true);
        profileEpoch.current += 1;
        clearSteps();
        setStage("greeting");
        setProfile(null);
        setLocalReviewCount(0);
        stageRestored.current = false;
        try {
            await fetch(`${OTTO_API}/onboarding/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId, serverId }),
            });
        } catch { /* ignore */ } finally {
            setResetting(false);
        }
    }, [channelId, serverId, resetting]);

    // Subway map active index — derived from stage
    const subwayActiveIndex = (() => {
        if (stage === "greeting")    return steps.findIndex(s => s.id === "greeting");
        if (stage === "upload" || stage === "upload_done")
                                     return steps.findIndex(s => s.id === "form_book");
        if (stage === "checkpoint")  return activeCheckpoint ? steps.findIndex(s => s.id === activeCheckpoint.id) : -1;
        if (stage === "reviews")     return steps.findIndex(s => s.id === "form_author");
        return -1;
    })();

    // Subway map click → stage
    function onSelectStep(index: number) {
        const s = steps[index];
        if (!s) return;
        if (s.id === "greeting")   setStage("greeting");
        else if (s.id === "form_book")   setStage(uploadStep?.done ? "upload_done" : "upload");
        else if (s.type === "checkpoint" && s.needsAction) setStage("checkpoint");
        else if (s.id === "form_author") setStage("reviews");
    }

    // Dome nav
    const canPrev = stage !== "greeting";
    const canNext = stage === "upload_done";
    function prev() {
        if (stage === "upload")        setStage("greeting");
        else if (stage === "upload_done") setStage("upload");
        else if (stage === "reviews")  setStage("upload_done");
    }
    function goToReviews() { setStage("reviews"); }

    // Content per stage
    function renderContent() {
        if (steps.length === 0) return <EmptyState>Waiting for Otto…</EmptyState>;

        switch (stage) {
            case "greeting":
                if (!greetingStep?.data) return <EmptyState>Waiting for Otto…</EmptyState>;
                return (
                    <GreetingStep
                        data={greetingStep.data}
                        channelId={channelId}
                        prefillName={profile?.authorName || invitationName}
                        onDone={(name: string) => {
                            patchStepData(greetingStep.id, { prefill_name: name });
                            markDone(greetingStep.id);
                            if (serverId) {
                                fetch(`${OTTO_API}/onboarding/${serverId}/name`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name }),
                                }).catch(() => {});
                            }
                            setStage("upload");
                        }}
                    />
                );

            case "upload":
                if (!uploadStep?.data) return <EmptyState>Waiting for upload form…</EmptyState>;
                return (
                    <FormStep
                        step={uploadStep}
                        channelId={channelId}
                        onDone={() => {
                            markDone(uploadStep.id);
                            setStage("upload_done");
                        }}
                    />
                );

            case "upload_done":
                return (
                    <ConfirmCard>
                        <ConfirmIcon>📖</ConfirmIcon>
                        <ConfirmHeading>Your book is on its way</ConfirmHeading>
                        <ConfirmBody>
                            Quill is processing it in the background. While that runs, let's add your reader reviews.
                        </ConfirmBody>
                        <SubmitBtn onClick={goToReviews}>Add Reviews →</SubmitBtn>
                    </ConfirmCard>
                );

            case "checkpoint":
                if (!activeCheckpoint) return <EmptyState>Waiting for review…</EmptyState>;
                return (
                    <CheckpointStep
                        step={activeCheckpoint}
                        channelId={channelId}
                        onDone={() => {
                            markDone(activeCheckpoint.id);
                            // Stay on checkpoint stage if another checkpoint is pending, else go to reviews
                            const nextCheckpoint = steps.find(
                                s => s.type === "checkpoint" && s.needsAction && !s.done && s.id !== activeCheckpoint.id
                            );
                            setStage(nextCheckpoint ? "checkpoint" : "reviews");
                        }}
                    />
                );

            case "reviews":
                if (!reviewStep) return (
                    <ProcessWrap>
                        <Spinner />
                        <span>Loading review form…</span>
                    </ProcessWrap>
                );
                if (reviewsDone) return (
                    <ConfirmCard>
                        <ConfirmIcon>★</ConfirmIcon>
                        <ConfirmHeading>Review added</ConfirmHeading>
                        <ConfirmBody>Add another review or continue to the next step.</ConfirmBody>
                        <div style={{ display: "flex", gap: 10 }}>
                            <SecondaryBtn onClick={() => { setReviewsDone(false); setReviewKey(k => k + 1); }}>
                                Add another
                            </SecondaryBtn>
                            <SubmitBtn style={{ flex: 1 }} onClick={() => setStage("done")}>
                                Continue →
                            </SubmitBtn>
                        </div>
                    </ConfirmCard>
                );
                return (
                    <FormStep
                        key={reviewKey}
                        step={reviewStep}
                        channelId={channelId}
                        onSkip={() => setStage("done")}
                        onDone={(reviewValues) => {
                            markDone(reviewStep.id);
                            if (serverId && reviewValues) {
                                fetch(`${OTTO_API}/onboarding/${serverId}/review`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        rating:      reviewValues.rating ?? "",
                                        reviewer:    reviewValues.reviewer ?? "",
                                        review_date: reviewValues.review_date ?? "",
                                        source:      reviewValues.source ?? "",
                                        review:      reviewValues.review ?? "",
                                    }),
                                }).catch(() => {});
                            }
                            setLocalReviewCount(c => c + 1);
                            setReviewsDone(true);
                        }}
                    />
                );

            case "done":
                return (
                    <ConfirmCard>
                        <ConfirmIcon>✓</ConfirmIcon>
                        <ConfirmHeading>All set</ConfirmHeading>
                        <ConfirmBody>Your studio is being prepared. You're all done here.</ConfirmBody>
                    </ConfirmCard>
                );
        }
    }

    return (
        <Overlay>
            <ModalWrapper>
                {canPrev && (
                    <DomeBtn $side="left" onClick={prev} title="Back">‹</DomeBtn>
                )}
                <Shell>
                    <Header>
                        <WizardTitle>Studio Setup</WizardTitle>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <ResetBtn $resetting={resetting} onClick={handleReset}>
                                {resetting ? "Resetting…" : "Start over"}
                            </ResetBtn>
                            <CloseBtn onClick={onClose}>×</CloseBtn>
                        </div>
                    </Header>

                    {stage !== "greeting" && (
                        <SubwayMap
                            steps={steps}
                            activeIndex={subwayActiveIndex}
                            onSelectStep={onSelectStep}
                            bookFilename={profile?.bookFilename}
                            reviewCount={localReviewCount}
                        />
                    )}

                    <Content>
                        {renderContent()}
                    </Content>
                    <PipelineBar
                        $active={steps.some(s => s.type === "processing")}
                        $progress={Math.min(
                            (steps.filter(s => s.type === "processing" && s.done).length +
                             (steps.some(s => s.type === "processing" && !s.done) ? 0.5 : 0)) / 8,
                            1
                        )}
                    />
                </Shell>
                {canNext && (
                    <DomeBtn $side="right" onClick={goToReviews} title="Add Reviews">›</DomeBtn>
                )}
            </ModalWrapper>
        </Overlay>
    );
}
