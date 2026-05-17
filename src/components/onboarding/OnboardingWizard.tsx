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
    border: 1px solid rgba(245, 166, 35, 0.4);
    ${p => p.$side === "left"
        ? "border-radius: 40px 0 0 40px; border-right: none;"
        : "border-radius: 0 40px 40px 0; border-left: none;"}
    color: #F5A623;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 0;
    &:hover {
        background: rgba(245, 166, 35, 0.28);
        color: #fff;
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
    color: rgba(255,255,255,0.58);
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
const SuccessMsg = styled.div`
    color: #65E572;
    font-size: 14px;
    font-weight: 600;
    padding: 12px 0;
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
const CheckpointActions = styled.div`
    display: flex;
    gap: 10px;
    margin-top: 20px;
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
    transition: background 0.15s;
    &:hover { background: rgba(101, 229, 114, 0.2); }
`;
const EditBtn = styled.button`
    background: transparent;
    color: var(--secondary-foreground);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 22px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    &:hover { border-color: rgba(255,255,255,0.3); color: var(--foreground); }
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

// ── step renderers ────────────────────────────────────────────────────────────

function GreetingStep({ data, channelId, onDone }: { data: any; channelId: string; onDone: () => void }) {
    const client = useClient();
    const fallback = (client as any)?.user?.username ?? (client as any)?.user?.display_name ?? "";
    const [name, setName] = useState<string>(data?.prefill_name || fallback);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!name && fallback) setName(fallback);
    }, [fallback]);

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
            onDone();
        }
    }

    return (
        <div>
            <GreetTitle>{data?.title ?? "Welcome"}</GreetTitle>
            {data?.description && <GreetDesc>{data.description}</GreetDesc>}

            <div style={{ marginBottom: 20 }}>
                <FormLabel as="div" style={{ marginBottom: 6 }}>What should we call you?</FormLabel>
                <FormInput
                    type="text"
                    value={name}
                    placeholder="Your name"
                    onInput={(e: Event) => setName((e.target as HTMLInputElement).value)}
                    style={{ fontSize: 16 }}
                />
            </div>

            {Array.isArray(data?.steps) && data.steps.length > 0 && (
                <GreetSteps style={{ marginBottom: 20 }}>
                    {data.steps.map((s: string, i: number) => (
                        <GreetStep key={i}>
                            <GreetNum>{i + 1}</GreetNum>
                            <span>{s}</span>
                        </GreetStep>
                    ))}
                </GreetSteps>
            )}

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
}: {
    step: WizardStep;
    channelId: string;
    onDone: () => void;
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
    const [submitted, setSubmitted] = useState(step.done);

    const set = (key: string) => (e: Event) =>
        setValues(v => ({ ...v, [key]: (e.target as HTMLInputElement).value }));

    const hasUploadField = (schema?.fields ?? []).some((f: any) => f.type === "upload" || f.type === "file");
    const canSubmit = !hasUploadField || !!uploadFile_;

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
            onDone();
        } finally {
            setSending(false);
        }
    }

    if (submitted) {
        return <SuccessMsg>Got it — Otto will continue shortly.</SuccessMsg>;
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
                                    <div style={{ fontSize: 32, lineHeight: 1 }}>📖</div>
                                    <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)", fontSize: 15 }}>Drop your manuscript here</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 2 }}>PDF, EPUB or TXT</div>
                                    <UploadCta>↑ &nbsp;Choose file</UploadCta>
                                </div>
                            )}
                        </UploadZone>
                    ) : field.type === "textarea" ? (
                        <FormTextarea
                            value={values[field.key] ?? ""}
                            placeholder={field.placeholder}
                            onInput={set(field.key)}
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
            <SubmitBtn $sending={sending} $disabled={!canSubmit} onClick={handleSubmit}>
                {sending ? "Sending…" : (schema?.submit ?? "Submit")}
            </SubmitBtn>
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
        return <SuccessMsg>Confirmed — pipeline continuing.</SuccessMsg>;
    }

    const main: string[]       = data?.main ?? data?.characters?.filter((c: any) => c.role === "Main").map((c: any) => c.name) ?? [];
    const supporting: string[] = data?.supporting ?? data?.characters?.filter((c: any) => c.role === "Supporting").map((c: any) => c.name) ?? [];
    const minor: string[]      = data?.minor ?? data?.characters?.filter((c: any) => c.role === "Minor").map((c: any) => c.name) ?? [];

    return (
        <div>
            <CheckpointTitle>{data?.title ?? "Review"}</CheckpointTitle>
            <CheckpointSub>{data?.subtitle ?? "Does this look right? Confirm to continue the pipeline."}</CheckpointSub>

            {main.length > 0 && (
                <CharGroup>
                    <CharGroupLabel>Main</CharGroupLabel>
                    <CharList>
                        {main.map((n: string) => <CharChip key={n} $role="Main">{n}</CharChip>)}
                    </CharList>
                </CharGroup>
            )}
            {supporting.length > 0 && (
                <CharGroup>
                    <CharGroupLabel>Supporting</CharGroupLabel>
                    <CharList>
                        {supporting.map((n: string) => <CharChip key={n} $role="Supporting">{n}</CharChip>)}
                    </CharList>
                </CharGroup>
            )}
            {minor.length > 0 && (
                <CharGroup>
                    <CharGroupLabel>Minor</CharGroupLabel>
                    <CharList>
                        {minor.map((n: string) => <CharChip key={n}>{n}</CharChip>)}
                    </CharList>
                </CharGroup>
            )}

            <CheckpointActions>
                <ConfirmBtn onClick={handleConfirm} disabled={confirming}>
                    {confirming ? "Confirming…" : "Looks good"}
                </ConfirmBtn>
                <EditBtn>Edit</EditBtn>
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

function StepContent({
    step,
    channelId,
    onDone,
}: {
    step: WizardStep;
    channelId: string;
    onDone: () => void;
}) {
    switch (step.type) {
        case "greeting":   return <GreetingStep data={step.data} channelId={channelId} onDone={() => onDone()} />;
        case "form":       return <FormStep step={step} channelId={channelId} onDone={onDone} />;
        case "checkpoint": return <CheckpointStep step={step} channelId={channelId} onDone={onDone} />;
        case "processing": return <ProcessingStep data={step.data} />;
    }
}

// ── main modal ────────────────────────────────────────────────────────────────

const OTTO_API = "https://otto.apricotter.com";

export default function OnboardingWizard({
    channelId,
    onClose,
}: ModalProps<"author_onboarding">) {
    const { steps, markDone, clearSteps } = useOnboardingMessages(channelId);
    const [activeIndex, setActiveIndex] = useState(0);
    const [resetting, setResetting] = useState(false);
    const autoAdvanced = useRef(false);

    // On first load, jump to the first step that still needs action
    useEffect(() => {
        if (steps.length === 0 || autoAdvanced.current) return;
        autoAdvanced.current = true;
        const firstPending = steps.findIndex(s => s.needsAction && !s.done);
        if (firstPending > 0) setActiveIndex(firstPending);
    }, [steps.length]);

    const handleReset = useCallback(async () => {
        if (resetting) return;
        setResetting(true);
        // Clear before the fetch so real-time messages from Otto land into a clean state
        clearSteps();
        setActiveIndex(0);
        autoAdvanced.current = false;
        try {
            await fetch(`${OTTO_API}/onboarding/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId }),
            });
        } catch {
            // ignore — Otto will re-greet on next message anyway
        } finally {
            setResetting(false);
        }
    }, [channelId, resetting]);

    const displayIndex = steps.length > 0
        ? Math.min(activeIndex, steps.length - 1)
        : 0;

    const activeStep = steps[displayIndex];

    const canPrev = displayIndex > 0;
    const canNext = displayIndex < steps.length - 1 && !(activeStep?.needsAction && !activeStep?.done);

    function prev() { if (canPrev) setActiveIndex(i => i - 1); }
    function next() { if (canNext) setActiveIndex(i => i + 1); }

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

                    <SubwayMap
                        steps={steps}
                        activeIndex={displayIndex}
                        onSelectStep={setActiveIndex}
                    />

                    <Content>
                        {steps.length === 0 ? (
                            <EmptyState>Waiting for Otto…</EmptyState>
                        ) : activeStep ? (
                            <StepContent
                                step={activeStep}
                                channelId={channelId}
                                onDone={() => {
                                    markDone(activeStep.id);
                                    setActiveIndex(i => Math.min(i + 1, steps.length - 1));
                                }}
                            />
                        ) : null}
                    </Content>
                </Shell>
                {canNext && (
                    <DomeBtn $side="right" onClick={next} title="Next">›</DomeBtn>
                )}
            </ModalWrapper>
        </Overlay>
    );
}
