import { useState } from "preact/hooks";
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
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
`;

const Shell = styled.div`
    background: var(--secondary-background);
    border-radius: 10px;
    width: min(660px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 0;
`;

const WizardTitle = styled.div`
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-foreground);
    text-transform: uppercase;
    letter-spacing: 0.07em;
`;

const CloseBtn = styled.button`
    background: none;
    border: none;
    color: var(--tertiary-foreground);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    &:hover { color: var(--foreground); }
`;

const Content = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    min-height: 180px;
`;

const NavBar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--tertiary-background);
`;

const NavBtn = styled.button<{ disabled?: boolean }>`
    background: var(--tertiary-background);
    border: none;
    border-radius: 6px;
    color: ${p => p.disabled ? "var(--tertiary-foreground)" : "var(--foreground)"};
    font-size: 13px;
    font-weight: 600;
    padding: 7px 18px;
    cursor: ${p => p.disabled ? "default" : "pointer"};
    opacity: ${p => p.disabled ? 0.4 : 1};
    transition: background 0.15s;
    &:hover:not(:disabled) { background: var(--primary-background); }
`;

const StepCount = styled.div`
    font-size: 12px;
    color: var(--tertiary-foreground);
`;

// ── step content ──────────────────────────────────────────────────────────────

// Greeting
const GreetTitle = styled.div`
    font-size: 20px;
    font-weight: 800;
    color: var(--foreground);
    margin-bottom: 10px;
`;
const GreetDesc = styled.div`
    font-size: 14px;
    color: var(--secondary-foreground);
    line-height: 1.6;
    margin-bottom: 14px;
`;
const GreetSteps = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
const GreetStep = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: var(--foreground);
`;
const GreetNum = styled.div`
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #F4B978;
    color: #080c18;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
`;

// Form
const FormTitle = styled.div`
    font-size: 16px;
    font-weight: 700;
    color: var(--foreground);
    margin-bottom: 16px;
`;
const FormField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 14px;
`;
const FormLabel = styled.label`
    font-size: 12px;
    font-weight: 600;
    color: var(--secondary-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
`;
const FormInput = styled.input`
    background: var(--primary-background);
    border: 1px solid var(--tertiary-background);
    border-radius: 6px;
    color: var(--foreground);
    font-size: 14px;
    padding: 8px 12px;
    outline: none;
    &:focus { border-color: var(--accent); }
`;
const FormTextarea = styled.textarea`
    background: var(--primary-background);
    border: 1px solid var(--tertiary-background);
    border-radius: 6px;
    color: var(--foreground);
    font-size: 14px;
    padding: 8px 12px;
    outline: none;
    resize: vertical;
    min-height: 80px;
    &:focus { border-color: var(--accent); }
`;
const FormSelect = styled.select`
    background: var(--primary-background);
    border: 1px solid var(--tertiary-background);
    border-radius: 6px;
    color: var(--foreground);
    font-size: 14px;
    padding: 8px 12px;
    outline: none;
`;
const UploadZone = styled.div<{ $dragging: boolean; $hasFile: boolean }>`
    border: 2px dashed ${p => p.$dragging || p.$hasFile ? "var(--accent)" : "var(--tertiary-background)"};
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    background: ${p => p.$dragging ? "rgba(244,185,120,0.08)" : "var(--primary-background)"};
    color: var(--secondary-foreground);
    font-size: 13px;
    transition: border-color 0.15s, background 0.15s;
`;
const SubmitBtn = styled.button<{ $sending?: boolean }>`
    background: var(--accent);
    color: var(--accent-contrast, #000);
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 24px;
    cursor: ${p => p.$sending ? "wait" : "pointer"};
    opacity: ${p => p.$sending ? 0.7 : 1};
    margin-top: 6px;
    transition: opacity 0.15s;
`;
const SuccessMsg = styled.div`
    color: #4ade80;
    font-size: 14px;
    font-weight: 600;
    padding: 12px 0;
`;

// Checkpoint
const CheckpointTitle = styled.div`
    font-size: 16px;
    font-weight: 700;
    color: var(--foreground);
    margin-bottom: 6px;
`;
const CheckpointSub = styled.div`
    font-size: 13px;
    color: var(--secondary-foreground);
    margin-bottom: 16px;
`;
const CharGroup = styled.div`
    margin-bottom: 14px;
`;
const CharGroupLabel = styled.div`
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--tertiary-foreground);
    margin-bottom: 6px;
`;
const CharList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;
const CharChip = styled.div<{ $role?: "Main" | "Supporting" | "Minor" }>`
    background: ${p =>
        p.$role === "Main"       ? "rgba(244,185,120,0.15)" :
        p.$role === "Supporting" ? "rgba(96,165,250,0.12)"  :
        "var(--tertiary-background)"};
    border: 1px solid ${p =>
        p.$role === "Main"       ? "#F4B978" :
        p.$role === "Supporting" ? "#60a5fa"  :
        "var(--tertiary-background)"};
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--foreground);
`;
const CheckpointActions = styled.div`
    display: flex;
    gap: 10px;
    margin-top: 18px;
`;
const ConfirmBtn = styled.button`
    background: #4ade80;
    color: #0a1f0a;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 22px;
    cursor: pointer;
`;
const EditBtn = styled.button`
    background: var(--tertiary-background);
    color: var(--foreground);
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 22px;
    cursor: pointer;
`;

// Processing
const ProcessWrap = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    color: var(--secondary-foreground);
    font-size: 14px;
    padding: 8px 0;
`;
const Spinner = styled.div`
    width: 20px;
    height: 20px;
    border: 2px solid var(--tertiary-background);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    @keyframes spin { to { transform: rotate(360deg); } }
    flex-shrink: 0;
`;

const EmptyState = styled.div`
    color: var(--tertiary-foreground);
    font-size: 14px;
    text-align: center;
    padding: 32px 0;
`;

// ── step renderers ────────────────────────────────────────────────────────────

function GreetingStep({ data }: { data: any }) {
    return (
        <div>
            <GreetTitle>{data?.title ?? "Welcome"}</GreetTitle>
            {data?.description && <GreetDesc>{data.description}</GreetDesc>}
            {Array.isArray(data?.steps) && data.steps.length > 0 && (
                <GreetSteps>
                    {data.steps.map((s: string, i: number) => (
                        <GreetStep key={i}>
                            <GreetNum>{i + 1}</GreetNum>
                            <span>{s}</span>
                        </GreetStep>
                    ))}
                </GreetSteps>
            )}
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

    async function handleSubmit() {
        if (sending || submitted) return;
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
                            {uploadFile_ ? uploadFile_.name : "Drop a file here or click to browse"}
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
                    ) : (
                        <FormInput
                            type="text"
                            value={values[field.key] ?? ""}
                            placeholder={field.placeholder ?? ""}
                            onInput={set(field.key)}
                        />
                    )}
                </FormField>
            ))}
            <SubmitBtn $sending={sending} onClick={handleSubmit}>
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
        case "greeting":   return <GreetingStep data={step.data} />;
        case "form":       return <FormStep step={step} channelId={channelId} onDone={onDone} />;
        case "checkpoint": return <CheckpointStep step={step} channelId={channelId} onDone={onDone} />;
        case "processing": return <ProcessingStep data={step.data} />;
    }
}

// ── main modal ────────────────────────────────────────────────────────────────

export default function OnboardingWizard({
    channelId,
    onClose,
}: ModalProps<"author_onboarding">) {
    const { steps, markDone } = useOnboardingMessages(channelId);
    const [activeIndex, setActiveIndex] = useState(0);

    // Auto-advance to first step needing action when steps load
    const firstPending = steps.findIndex(s => s.needsAction && !s.done);
    const displayIndex = steps.length > 0
        ? Math.min(activeIndex, steps.length - 1)
        : 0;

    const activeStep = steps[displayIndex];

    const canPrev = displayIndex > 0;
    const canNext = displayIndex < steps.length - 1;

    function prev() { if (canPrev) setActiveIndex(i => i - 1); }
    function next() { if (canNext) setActiveIndex(i => i + 1); }

    return (
        <Overlay onClick={e => e.target === e.currentTarget && onClose()}>
            <Shell>
                <Header>
                    <WizardTitle>Studio Setup</WizardTitle>
                    <CloseBtn onClick={onClose}>×</CloseBtn>
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
                                if (canNext) setActiveIndex(i => i + 1);
                            }}
                        />
                    ) : null}
                </Content>

                <NavBar>
                    <NavBtn disabled={!canPrev} onClick={prev}>← Back</NavBtn>
                    <StepCount>
                        {steps.length > 0
                            ? `${displayIndex + 1} / ${steps.length}`
                            : "—"}
                    </StepCount>
                    <NavBtn disabled={!canNext} onClick={next}>Next →</NavBtn>
                </NavBar>
            </Shell>
        </Overlay>
    );
}
