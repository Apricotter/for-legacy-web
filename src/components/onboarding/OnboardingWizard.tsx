import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { createPortal } from "preact/compat";
import { EditAlt, Bulb, Refresh } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";
import { track } from "../../lib/analytics";

import { uploadFile } from "../../controllers/client/jsx/legacy/FileUploads";
import { useClient } from "../../controllers/client/ClientController";
import { ModalProps } from "../../controllers/modals/types";

import SubwayMap from "./SubwayMap";
import { useOnboardingMessages, WizardStep } from "./useOnboardingMessages";

// ── pipeline step registry ────────────────────────────────────────────────────

const PIPELINE_STEPS = [
    "extract", "tokenize", "scene_builder", "chunk",
    "embed", "summarize",
    "scene_enrich_labels", "scene_enrich_gliner",
    "gliner", "character_roster",
    "booknlp", "detect_narration", "character_dialog",
    "build_graph", "prune_graph", "drop_bg_characters",
    "character_appearance", "describe_characters",
    "prune_using_descriptions", "roster_with_descriptions", "refine_roster",
    "character_review",
    "character_portraits", "scene_stills",
] as const;

type BookProgress = {
    jobId: string;
    slug: string;
    name: string;
    status: "running" | "checkpoint" | "complete" | "error";
    currentStep: string;
    checkpointStep?: string;
    checkpointSummary?: string;
    checkpointData?: any;
    portraitsUrl?: string;
    sceneStillsUrl?: string;
    updatedAt: string;
};

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
                                if (f) { setUploadFile(f); track("upload_book_selected", { serverId, filename: f.name, method: "drop" }); }
                            }}
                            onClick={() => {
                                track("upload_book_clicked", { serverId });
                                const inp = document.createElement("input");
                                inp.type = "file";
                                inp.accept = field.accept ?? ".pdf,.epub,.txt";
                                inp.onchange = ev => {
                                    const f = (ev.target as HTMLInputElement).files?.[0];
                                    if (f) { setUploadFile(f); track("upload_book_selected", { serverId, filename: f.name, method: "browse" }); }
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
                            <option value="" style={{ color: "#000" }}>Select...</option>
                            {(field.options ?? field.choices ?? []).map((o: string) => (
                                <option key={o} value={o} style={{ color: "#000" }}>{o}</option>
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
                            style={{ accentColor: "#F5A623", cursor: "pointer", flexShrink: 0 }}
                        />
                        <CharRowName>{name}</CharRowName>
                        <CharRoleTag $role={role}>{role}</CharRoleTag>
                    </CharRow>
                ))}
            </CharScrollList>

            <CheckpointActions>
                <SubmitBtn $sending={confirming} onClick={handleConfirm}>
                    {confirming ? "Confirming…" : "Looks good →"}
                </SubmitBtn>
            </CheckpointActions>
        </div>
    );
}

// ── Character review checkpoint ───────────────────────────────────────────────

const ReviewCounter = styled.div`
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.04em;
    text-transform: uppercase;
`;
const ReviewNav = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 4px;
`;

// Preview card (inside wizard Shell)
const PreviewCard = styled.div`
    display: flex;
    height: 260px;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
`;
const PreviewPortraitCol = styled.div`
    width: 38%;
    flex-shrink: 0;
    overflow: hidden;
`;
const PreviewPortraitImg = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
`;
const PreviewPortraitPlaceholder = styled.div`
    width: 100%;
    height: 100%;
    background: rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    color: rgba(255,255,255,0.18);
`;
const PreviewRight = styled.div`
    flex: 1;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(255,255,255,0.018);
`;
const PreviewNameRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
`;
const PreviewName = styled.div`
    font-size: 16px;
    font-weight: 700;
    color: rgba(255,255,255,0.92);
    letter-spacing: -0.01em;
`;
const PreviewEditBtn = styled.button`
    background: none;
    border: none;
    color: #F5A623;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.15s, opacity 0.15s;
    flex-shrink: 0;
    opacity: 0.75;
    &:hover { opacity: 1; }
`;
const PreviewRoleTag = styled.div`
    font-size: 10px;
    color: rgba(255,255,255,0.36);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
`;
const PreviewDesc = styled.div`
    flex: 1;
    font-size: 12.5px;
    color: rgba(255,255,255,0.52);
    line-height: 1.65;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    -webkit-box-orient: vertical;
`;
const PreviewDetailsLink = styled.button`
    flex-shrink: 0;
    background: none;
    border: none;
    color: #F5A623;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    padding: 8px 0 0;
    text-align: left;
    transition: color 0.15s;
    &:hover { color: #f9b830; }
`;

// ── Character editor modal ─────────────────────────────────────────────────────

const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
`;
const EditorShell = styled.div`
    position: relative;
    width: 90vw;
    height: 90vh;
    background: rgba(10,6,2,0.97);
    border: 1px solid rgba(255,255,255,0.08);
    border-top: 1px solid rgba(244,185,120,0.28);
    border-radius: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 40px 120px rgba(0,0,0,0.88);
`;
const EditorCloseBtn = styled.button`
    position: absolute;
    top: 14px;
    right: 16px;
    z-index: 20;
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;
    &:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.07); }
`;
const EditorBody = styled.div`
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
`;
const EditorPortraitCol = styled.div`
    width: 40%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0a0602;
`;
const EditorPortraitImgWrap = styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 0;
`;
const EditorPortraitImg = styled.img`
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
`;
const EditorPortraitPlaceholder = styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 96px;
    color: rgba(255,255,255,0.14);
`;
const RegenBtn = styled.button<{ $dirty: boolean }>`
    flex-shrink: 0;
    margin: 12px;
    padding: 10px 0;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    cursor: ${p => p.$dirty ? "pointer" : "not-allowed"};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
    background: ${p => p.$dirty ? "#F5A623" : "transparent"};
    border: 1.5px solid ${p => p.$dirty ? "#F5A623" : "rgba(245,166,35,0.3)"};
    color: ${p => p.$dirty ? "#1a0e00" : "rgba(245,166,35,0.4)"};
    box-shadow: ${p => p.$dirty ? "0 4px 20px rgba(245,166,35,0.35)" : "none"};
    &:hover:not([disabled]) {
        background: ${p => p.$dirty ? "#f9b830" : "rgba(245,166,35,0.06)"};
        border-color: ${p => p.$dirty ? "#f9b830" : "rgba(245,166,35,0.55)"};
        color: ${p => p.$dirty ? "#1a0e00" : "rgba(245,166,35,0.7)"};
    }
`;
const EditorRight = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid rgba(255,255,255,0.07);
    position: relative;
`;
const EditorRightHeader = styled.div`
    padding: 20px 22px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
`;
const EditorCharName = styled.div`
    font-size: 20px;
    font-weight: 800;
    color: rgba(255,255,255,0.95);
    letter-spacing: -0.02em;
`;
const EditorCharRole = styled.div`
    font-size: 12px;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-top: 3px;
`;
const EditorScrollArea = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 18px 22px 12px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: 0;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
`;
const AttrSectionLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.26);
    margin-bottom: 8px;
`;
const AttrText = styled.div`
    font-size: 13px;
    color: rgba(255,255,255,0.68);
    line-height: 1.7;
`;
const ChatThread = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;
const ChatBubble = styled.div<{ $role: "user" | "assistant" }>`
    max-width: 92%;
    align-self: ${p => p.$role === "user" ? "flex-end" : "flex-start"};
    background: ${p => p.$role === "user" ? "rgba(245,166,35,0.13)" : "rgba(255,255,255,0.05)"};
    border: 1px solid ${p => p.$role === "user" ? "rgba(245,166,35,0.28)" : "rgba(255,255,255,0.09)"};
    border-radius: ${p => p.$role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px"};
    padding: 8px 12px;
    font-size: 13px;
    color: rgba(255,255,255,0.78);
    line-height: 1.5;
`;
const EditorChatRow = styled.div`
    padding: 10px 22px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
`;
const PromptToggleBtn = styled.button`
    margin: 0 22px 10px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.75);
    font-size: 12px;
    font-weight: 500;
    padding: 4px 0;
    cursor: pointer;
    text-align: left;
    flex-shrink: 0;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: rgba(255,255,255,0.35);
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,1); }
`;
const EditorFooter = styled.div`
    padding: 14px 22px;
    border-top: 1px solid rgba(255,255,255,0.07);
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
`;
const PromptPopoverPanel = styled.div<{ $open: boolean }>`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${p => p.$open ? "70%" : "0"};
    background: rgba(8,4,1,0.97);
    border-top: 1px solid rgba(244,185,120,0.28);
    overflow: hidden;
    transition: height 0.28s cubic-bezier(0.4,0,0.2,1);
    display: flex;
    flex-direction: column;
    z-index: 10;
`;
const PromptPopoverInner = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px 22px;
    gap: 12px;
    overflow: hidden;
    min-height: 0;
`;
const PromptPopoverLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.28);
    flex-shrink: 0;
`;
const AttrList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
`;
const AttrChip = styled.div`
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 4px 8px 4px 11px;
    font-size: 12px;
    color: rgba(255,255,255,0.65);
    line-height: 1.4;
    text-decoration: underline;
    text-decoration-color: rgba(245,166,35,0.55);
    text-underline-offset: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
`;
const AttrChipRemove = styled.button`
    background: none;
    border: none;
    color: #F5A623;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.12s;
    &:hover { opacity: 1; }
`;
const AttrAddBtn = styled.button`
    background: #F5A623;
    border: none;
    border-radius: 20px;
    padding: 4px 11px;
    font-size: 14px;
    font-weight: 800;
    color: #1a0e00;
    cursor: pointer;
    line-height: 1.2;
    transition: background 0.15s;
    &:hover { background: #f9b830; }
`;
const AttrTip = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: rgba(255,255,255,0.28);
    margin-bottom: 8px;
    font-weight: 500;
`;

type CharAppearance = { introduction?: string; imagePrompt?: string };
type CharEditState  = { description: string; imagePrompt: string };
type ChatMsg        = { role: "user" | "assistant"; text: string };

function parseAttrChips(imagePrompt: string): string[] {
    return imagePrompt
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 60);
}

const AttrChipInput = styled.input`
    background: rgba(245,166,35,0.1);
    border: 1px solid rgba(245,166,35,0.45);
    border-radius: 20px;
    padding: 4px 11px;
    font-size: 12px;
    color: rgba(255,255,255,0.9);
    line-height: 1.4;
    outline: none;
    min-width: 60px;
    width: auto;
`;

function CharacterEditorModal({
    char,
    jobId,
    editState,
    onSave,
    onClose,
}: {
    char: { name: string; role: string; description?: string; portraitUrl?: string; appearance?: CharAppearance };
    jobId: string;
    editState: CharEditState;
    onSave: (s: CharEditState) => void;
    onClose: () => void;
}) {
    const [localDesc,    setLocalDesc]    = useState(editState.description);
    const [localPrompt,  setLocalPrompt]  = useState(editState.imagePrompt);
    const [chips,        setChips]        = useState<string[]>(() => parseAttrChips(editState.imagePrompt));
    const [editChipIdx,  setEditChipIdx]  = useState<number | null>(null);

    function commitChips(next: string[]) {
        setChips(next);
        setLocalPrompt(next.filter(c => c.trim()).join(", "));
    }

    function updateChip(idx: number, value: string) {
        const next = [...chips];
        next[idx] = value;
        setChips(next);
    }

    function finaliseChip(idx: number) {
        const trimmed = chips[idx].trim();
        const next = trimmed ? chips.map((c, i) => i === idx ? trimmed : c) : chips.filter((_, i) => i !== idx);
        commitChips(next);
        setEditChipIdx(null);
    }

    function removeChip(idx: number) {
        commitChips(chips.filter((_, i) => i !== idx));
    }

    function addChip() {
        const next = [...chips, ""];
        setChips(next);
        setEditChipIdx(next.length - 1);
    }
    const initialChips = useRef<string[]>(parseAttrChips(editState.imagePrompt));
    const isDirty = chips.length !== initialChips.current.length || chips.some((c, i) => c !== initialChips.current[i]);

    async function handleRegen() {
        // TODO: wire to ComfyUI endpoint when portrait regen is built
    }

    const [chat,        setChat]        = useState<ChatMsg[]>([]);
    const [instruction, setInstruction] = useState("");
    const [sending,     setSending]     = useState(false);
    const [promptOpen,  setPromptOpen]  = useState(false);
    const chatEndRef   = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const t = setTimeout(() => chatInputRef.current?.focus(), 400);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat.length]);

    async function handleInstruction() {
        const text = instruction.trim();
        if (!text || sending) return;
        setSending(true);
        setInstruction("");
        setChat(h => [...h, { role: "user", text }]);
        try {
            const r = await fetch(
                `${OTTO_API}/jobs/${jobId}/characters/${encodeURIComponent(char.name)}/redescribe`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ instruction: text, currentDescription: localDesc }),
                }
            );
            if (r.ok) {
                const { description } = await r.json();
                setLocalDesc(description);
                setChat(h => [...h, { role: "assistant", text: description }]);
            } else {
                setChat(h => [...h, { role: "assistant", text: "Could not regenerate — please try again." }]);
            }
        } catch {
            setChat(h => [...h, { role: "assistant", text: "Network error — please try again." }]);
        } finally {
            setSending(false);
        }
    }

    return createPortal(
        <ModalOverlay onClick={(e: any) => e.target === e.currentTarget && onClose()}>
            <EditorShell>
                <EditorCloseBtn onClick={onClose} title="Close">×</EditorCloseBtn>
                <EditorBody>
                    <EditorPortraitCol>
                        <EditorPortraitImgWrap>
                            {char.portraitUrl
                                ? <EditorPortraitImg src={char.portraitUrl} alt={char.name} />
                                : <EditorPortraitPlaceholder>👤</EditorPortraitPlaceholder>}
                        </EditorPortraitImgWrap>
                        <RegenBtn $dirty={isDirty} disabled={!isDirty} onClick={handleRegen}>
                            <Refresh size={14} /> Regenerate Portrait
                        </RegenBtn>
                    </EditorPortraitCol>
                    <EditorRight>
                        <EditorRightHeader>
                            <EditorCharName>{char.name}</EditorCharName>
                            <EditorCharRole>{char.role}</EditorCharRole>
                        </EditorRightHeader>
                        <EditorScrollArea>
                            <div>
                                <AttrSectionLabel>Attributes</AttrSectionLabel>
                                <AttrTip>
                                    <Bulb size={13} style={{ color: "#F5A623", flexShrink: 0 }} />
                                    <span style={{ color: "#F5A623", fontWeight: 700 }}>Tip</span>
                                    <span style={{ color: "rgba(255,255,255,0.8)" }}>Click a chip to edit</span>
                                </AttrTip>
                                <AttrList>
                                    {chips.map((chip, i) =>
                                        editChipIdx === i
                                            ? <AttrChipInput
                                                key={i}
                                                value={chip}
                                                onInput={(e: any) => updateChip(i, e.target.value)}
                                                onBlur={() => finaliseChip(i)}
                                                onKeyDown={(e: any) => e.key === "Enter" && finaliseChip(i)}
                                                style={{ width: Math.max(60, chip.length * 8) + "px" }}
                                                autoFocus
                                              />
                                            : <AttrChip key={i} onClick={() => setEditChipIdx(i)}>
                                                <span>{chip}</span>
                                                <AttrChipRemove onClick={(e: any) => { e.stopPropagation(); removeChip(i); }}>×</AttrChipRemove>
                                              </AttrChip>
                                    )}
                                    <AttrAddBtn onClick={addChip}>+</AttrAddBtn>
                                </AttrList>
                            </div>
                            {char.appearance?.introduction && (
                                <div>
                                    <AttrSectionLabel>Appearance</AttrSectionLabel>
                                    <AttrText>{char.appearance.introduction}</AttrText>
                                </div>
                            )}
                            {chat.length > 0 && (
                                <div>
                                    <AttrSectionLabel>AI Chat</AttrSectionLabel>
                                    <ChatThread>
                                        {chat.map((m, i) => (
                                            <ChatBubble key={i} $role={m.role}>{m.text}</ChatBubble>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </ChatThread>
                                </div>
                            )}
                        </EditorScrollArea>
                        <EditorChatRow>
                            <FormInput
                                ref={chatInputRef}
                                type="text"
                                value={instruction}
                                placeholder="Ask Quill to rewrite… (e.g. make her sound older)"
                                onInput={(e: any) => setInstruction(e.target.value)}
                                onKeyDown={(e: any) => e.key === "Enter" && handleInstruction()}
                                style={{ flex: 1 }}
                            />
                            <SubmitBtn
                                $sending={sending}
                                $disabled={!instruction.trim() || sending}
                                onClick={handleInstruction}
                                style={{ width: "auto", padding: "9px 16px", margin: 0, flexShrink: 0 }}
                            >
                                {sending ? "…" : "→"}
                            </SubmitBtn>
                        </EditorChatRow>
                        <PromptToggleBtn onClick={() => setPromptOpen(p => !p)}>
                            {promptOpen ? "▾" : "▸"} Prompt
                        </PromptToggleBtn>
                        <PromptPopoverPanel $open={promptOpen}>
                            <PromptPopoverInner>
                                <PromptPopoverLabel>Diffusion Prompt</PromptPopoverLabel>
                                <FormTextarea
                                    value={localPrompt}
                                    onInput={(e: any) => setLocalPrompt(e.target.value)}
                                    placeholder="Diffusion prompt…"
                                    style={{ flex: 1, resize: "none", minHeight: 0, overflowY: "auto" as any }}
                                />
                                <SecondaryBtn
                                    style={{ flex: "none" as any, padding: "9px 0" }}
                                    onClick={() => setPromptOpen(false)}
                                >
                                    Close
                                </SecondaryBtn>
                            </PromptPopoverInner>
                        </PromptPopoverPanel>
                    </EditorRight>
                </EditorBody>
                <EditorFooter>
                    <div style={{ display: "flex", gap: 10 }}>
                        <SecondaryBtn style={{ width: 130 }} onClick={onClose}>Cancel</SecondaryBtn>
                        <SubmitBtn
                            style={{ width: 130, margin: 0 }}
                            onClick={() => { onSave({ description: localDesc, imagePrompt: localPrompt }); onClose(); }}
                        >
                            Save changes
                        </SubmitBtn>
                    </div>
                </EditorFooter>
            </EditorShell>
        </ModalOverlay>, document.body);
}

// ── Roster row styled components ─────────────────────────────────────────────

const RosterList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 340px;
    overflow-y: auto;
    margin-bottom: 12px;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
`;
const RosterRow = styled.div`
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.02);
    display: flex;
    flex-direction: column;
    gap: 4px;
`;
const RosterRowHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;
const RosterRowName = styled.div`
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.92);
    flex: 1;
`;
const RosterRowDesc = styled.div`
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
const RosterRowBtn = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 5px;
    font-size: 12px;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
`;
const RosterAddRow = styled.button`
    border: 1px dashed rgba(245,166,35,0.35);
    border-radius: 10px;
    padding: 9px 12px;
    background: none;
    color: #F5A623;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    &:hover { border-color: #F5A623; background: rgba(245,166,35,0.05); }
`;

// ── Simple description editor modal (pre-portrait) ────────────────────────────

const DescEditorShell = styled.div`
    position: relative;
    width: min(520px, 92vw);
    max-height: 80vh;
    background: rgba(10,6,2,0.97);
    border: 1px solid rgba(255,255,255,0.08);
    border-top: 1px solid rgba(244,185,120,0.28);
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(0,0,0,0.85);
`;

function CharDescEditorModal({
    name: initialName,
    role,
    description: initialDesc,
    jobId,
    isNew,
    onSave,
    onClose,
}: {
    name: string;
    role: string;
    description: string;
    jobId: string;
    isNew?: boolean;
    onSave: (name: string, role: string, description: string) => void;
    onClose: () => void;
}) {
    const [localName, setLocalName]   = useState(initialName);
    const [localRole, setLocalRole]   = useState(role);
    const [localDesc, setLocalDesc]   = useState(initialDesc);
    const [chat,      setChat]        = useState<ChatMsg[]>([]);
    const [instruction, setInstruction] = useState("");
    const [sending,   setSending]     = useState(false);
    const chatEndRef   = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const t = setTimeout(() => chatInputRef.current?.focus(), 300);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat.length]);

    async function handleInstruction() {
        const text = instruction.trim();
        if (!text || sending) return;
        setSending(true);
        setInstruction("");
        setChat(h => [...h, { role: "user", text }]);
        try {
            const r = await fetch(
                `${OTTO_API}/jobs/${jobId}/characters/${encodeURIComponent(localName)}/redescribe`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ instruction: text, currentDescription: localDesc }),
                }
            );
            if (r.ok) {
                const { description } = await r.json();
                setLocalDesc(description);
                setChat(h => [...h, { role: "assistant", text: description }]);
            } else {
                setChat(h => [...h, { role: "assistant", text: "Could not regenerate — please try again." }]);
            }
        } catch {
            setChat(h => [...h, { role: "assistant", text: "Network error — please try again." }]);
        } finally {
            setSending(false);
        }
    }

    return createPortal(
        <ModalOverlay onClick={(e: any) => e.target === e.currentTarget && onClose()}>
            <DescEditorShell>
                <EditorCloseBtn onClick={onClose}>×</EditorCloseBtn>
                <EditorScrollArea style={{ padding: "20px 22px 12px" }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                        <FormField style={{ flex: 2, margin: 0 }}>
                            <FormLabel>Name</FormLabel>
                            <FormInput
                                type="text"
                                value={localName}
                                onInput={(e: any) => setLocalName(e.target.value)}
                            />
                        </FormField>
                        <FormField style={{ flex: 1, margin: 0 }}>
                            <FormLabel>Role</FormLabel>
                            <FormSelect value={localRole} onChange={(e: any) => setLocalRole(e.target.value)}>
                                <option value="Main" style={{ color: "#000" }}>Main</option>
                                <option value="Supporting" style={{ color: "#000" }}>Supporting</option>
                                <option value="Minor" style={{ color: "#000" }}>Minor</option>
                            </FormSelect>
                        </FormField>
                    </div>
                    <FormField style={{ margin: 0, marginBottom: 14 }}>
                        <FormLabel>Description</FormLabel>
                        <FormTextarea
                            value={localDesc}
                            onInput={(e: any) => setLocalDesc(e.target.value)}
                            placeholder="Character description…"
                            style={{ minHeight: 100 }}
                        />
                    </FormField>
                    {chat.length > 0 && (
                        <ChatThread style={{ marginBottom: 8 }}>
                            {chat.map((m, i) => (
                                <ChatBubble key={i} $role={m.role}>{m.text}</ChatBubble>
                            ))}
                            <div ref={chatEndRef} />
                        </ChatThread>
                    )}
                </EditorScrollArea>
                <EditorChatRow>
                    <FormInput
                        ref={chatInputRef}
                        type="text"
                        value={instruction}
                        placeholder="Ask Quill to rewrite… (e.g. make them sound older)"
                        onInput={(e: any) => setInstruction(e.target.value)}
                        onKeyDown={(e: any) => e.key === "Enter" && handleInstruction()}
                        style={{ flex: 1 }}
                    />
                    <SubmitBtn
                        $sending={sending}
                        $disabled={!instruction.trim() || sending}
                        onClick={handleInstruction}
                        style={{ width: "auto", padding: "9px 16px", margin: 0, flexShrink: 0 }}
                    >
                        {sending ? "…" : "→"}
                    </SubmitBtn>
                </EditorChatRow>
                <EditorFooter>
                    <div style={{ display: "flex", gap: 10 }}>
                        <SecondaryBtn style={{ width: 120 }} onClick={onClose}>Cancel</SecondaryBtn>
                        <SubmitBtn
                            style={{ width: 120, margin: 0 }}
                            onClick={() => { onSave(localName.trim() || initialName, localRole, localDesc); onClose(); }}
                        >
                            {isNew ? "Add" : "Save"}
                        </SubmitBtn>
                    </div>
                </EditorFooter>
            </DescEditorShell>
        </ModalOverlay>, document.body
    );
}

function CharacterReviewCheckpoint({ step, jobId, onDone }: {
    step: WizardStep;
    jobId: string;
    onDone: () => void;
}) {
    type CharAppearanceEntry = { introduction?: string; imagePrompt?: string };
    type CharEntry = {
        name: string;
        role: string;
        description: string;
        portraitUrl?: string;
        appearance?: CharAppearanceEntry;
    };

    const data = step.data;
    const initial: CharEntry[] = (data?.characters ?? []).map((c: any) => ({
        name:        c.name ?? "",
        role:        c.role ?? "Supporting",
        description: c.description ?? "",
        portraitUrl: c.portraitUrl,
        appearance:  c.appearance,
    }));

    const [chars,      setChars]      = useState<CharEntry[]>(initial);
    const [editIdx,    setEditIdx]    = useState<number | null>(null);
    const [addOpen,    setAddOpen]    = useState(false);
    const [confirming, setConfirming] = useState(false);

    async function handleConfirm() {
        if (confirming) return;
        setConfirming(true);
        try {
            if (jobId) {
                await fetch(`${OTTO_API}/jobs/${jobId}/characters/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ characters: chars }),
                });
            }
            const advanceUrl: string | undefined = data?.advance_url;
            if (advanceUrl) await fetch(advanceUrl, { method: "POST" });
            track("onboarding_checkpoint_submitted", {
                checkpointStep: step?.data?.step,
                approvedCount:  chars.length,
            });
            onDone();
        } finally {
            setConfirming(false);
        }
    }

    return (
        <>
            <CheckpointTitle>Your Cast</CheckpointTitle>
            <CheckpointSub>{chars.length} characters · review, edit or remove before portraits are generated.</CheckpointSub>

            <RosterList>
                {chars.map((c, i) => (
                    <RosterRow key={i}>
                        <RosterRowHeader>
                            <RosterRowName>{c.name}</RosterRowName>
                            <CharRoleTag $role={c.role}>{c.role}</CharRoleTag>
                            <RosterRowBtn
                                onClick={() => setEditIdx(i)}
                                style={{ color: "#F5A623" }}
                                title="Edit"
                            >
                                <EditAlt size={13} />
                            </RosterRowBtn>
                            <RosterRowBtn
                                onClick={() => setChars(prev => prev.filter((_, j) => j !== i))}
                                style={{ color: "rgba(255,80,80,0.7)" }}
                                title="Remove"
                            >
                                ×
                            </RosterRowBtn>
                        </RosterRowHeader>
                        {c.description && <RosterRowDesc>{c.description}</RosterRowDesc>}
                    </RosterRow>
                ))}
            </RosterList>

            <RosterAddRow onClick={() => setAddOpen(true)} style={{ marginBottom: 12 }}>
                + Add character
            </RosterAddRow>

            <SubmitBtn $sending={confirming} onClick={handleConfirm}>
                {confirming ? "Saving…" : "Confirm Cast →"}
            </SubmitBtn>

            {editIdx !== null && (
                <CharDescEditorModal
                    name={chars[editIdx].name}
                    role={chars[editIdx].role}
                    description={chars[editIdx].description}
                    jobId={jobId}
                    onSave={(name, role, description) =>
                        setChars(prev => prev.map((c, i) => i === editIdx ? { name, role, description } : c))
                    }
                    onClose={() => setEditIdx(null)}
                />
            )}

            {addOpen && (
                <CharDescEditorModal
                    name=""
                    role="Supporting"
                    description=""
                    jobId={jobId}
                    isNew
                    onSave={(name, role, description) => {
                        if (name) setChars(prev => [...prev, { name, role, description }]);
                    }}
                    onClose={() => setAddOpen(false)}
                />
            )}
        </>
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
    const { steps, markDone, patchStepData, clearSteps, activateCheckpoint } = useOnboardingMessages(channelId);
    const [stage, setStage] = useState<Stage>("greeting");
    const [resetting, setResetting] = useState(false);
    const [reviewsDone, setReviewsDone] = useState(false);
    const [reviewKey, setReviewKey] = useState(0);
    const [profile, setProfile] = useState<any>(null);
    const [bookProgress, setBookProgress] = useState<BookProgress | null>(null);
    const [invitationName, setInvitationName] = useState<string>("");
    const [localReviewCount, setLocalReviewCount] = useState(0);
    const stageRestored   = useRef(false);
    const profileEpoch    = useRef(0);
    const lastProgressRef = useRef(0);

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
                const lastBook = p.books?.[p.books.length - 1];
                if (lastBook?.status === "checkpoint") {
                    setStage("checkpoint");
                } else if (p.reviews?.length > 0) {
                    setStage("done");
                } else if (p.bookFilename) {
                    setStage("upload_done");
                } else if (p.authorName) {
                    setStage("upload");
                }
            });
    }, [serverId]);

    // Hydrate bookProgress from profile on initial load / page refresh
    useEffect(() => {
        if (!profile?.books?.length) return;
        setBookProgress(profile.books[profile.books.length - 1]);
    }, [profile]);

    // When profile shows a checkpoint, hydrate the checkpoint step so it shows on refresh
    useEffect(() => {
        if (!bookProgress || bookProgress.status !== "checkpoint") return;
        if (!bookProgress.checkpointStep) return;
        try {
            const parsed = bookProgress.checkpointData
                ? (typeof bookProgress.checkpointData === "string"
                    ? JSON.parse(bookProgress.checkpointData)
                    : bookProgress.checkpointData)
                : {};
            const chars = parsed?.characters ?? [];
            activateCheckpoint(bookProgress.checkpointStep ?? "", {
                ...parsed,
                step:        bookProgress.checkpointStep,
                advance_url: `${OTTO_API}/onboarding/${serverId}/advance`,
            });
            track("onboarding_checkpoint_reached", {
                serverId,
                checkpointStep: bookProgress.checkpointStep,
                characterCount: chars.length,
            });
        } catch { /* malformed checkpointData — activate with empty characters */ }
    }, [bookProgress?.status, bookProgress?.checkpointStep]);

    // Fetch profile to sync bookProgress whenever processing activity changes or stage reaches upload_done
    const processingStepCount = steps.filter(s => s.type === "processing").length;
    const fetchBookProgress = useCallback(() => {
        if (!serverId) return;
        fetch(`${OTTO_API}/onboarding/${serverId}/profile`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(p => {
                const prog: BookProgress | undefined = p?.books?.[p.books.length - 1];
                if (prog) setBookProgress(prog);
            });
    }, [serverId]);
    useEffect(() => {
        if (!processingStepCount || !serverId) return;
        fetchBookProgress();
    }, [processingStepCount]);
    useEffect(() => {
        if (stage === "upload_done") fetchBookProgress();
    }, [stage]);

    // Keep bookProgress fresh while pipeline is running or waiting at a checkpoint
    useEffect(() => {
        if (bookProgress?.status !== "running" && bookProgress?.status !== "checkpoint") return;
        const id = setInterval(fetchBookProgress, 5000);
        return () => clearInterval(id);
    }, [bookProgress?.status, fetchBookProgress]);

    // Safety net: push to checkpoint stage if backend is waiting and stage hasn't transitioned
    useEffect(() => {
        if (!bookProgress) return;
        if (bookProgress.status !== "checkpoint") return;
        if (stage === "checkpoint" || stage === "reviews" || stage === "done") return;
        setStage("checkpoint");
    }, [bookProgress?.status]);

    // Auto-advance to done when pipeline completes while wizard is open
    useEffect(() => {
        if (bookProgress?.status !== "complete") return;
        if (stage === "done") return;
        track("pipeline_completed", { serverId, bookSlug: bookProgress.slug });
        setStage("done");
    }, [bookProgress?.status]);

    // Notify backend that the author has finished onboarding
    useEffect(() => {
        if (stage !== "done" || !serverId) return;
        track("onboarding_completed", { serverId, bookSlug: bookProgress?.slug });
        fetch(`${OTTO_API}/onboarding/${serverId}/complete`, { method: "POST" }).catch(() => {});
    }, [stage, serverId]);

    // Auto-advance stage if backend moved past checkpoint (e.g., manual advance via admin tool)
    useEffect(() => {
        if (stage !== "checkpoint") return;
        if (!bookProgress) return;
        if (bookProgress.status === "checkpoint") return;
        const active = steps.find(s => s.type === "checkpoint" && s.needsAction && !s.done);
        if (!active) return;
        markDone(active.id);
        const nextCheckpoint = steps.find(
            s => s.type === "checkpoint" && s.needsAction && !s.done && s.id !== active.id
        );
        setStage(nextCheckpoint ? "checkpoint" : "reviews");
    }, [bookProgress?.status, stage]);

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

    // Auto-transition to checkpoint when one becomes active (from any non-terminal stage)
    useEffect(() => {
        if (activeCheckpoint && stage !== "checkpoint" && stage !== "reviews" && stage !== "done")
            setStage("checkpoint");
    }, [activeCheckpoint?.id]);

    const handleReset = useCallback(async () => {
        if (resetting) return;
        track("wizard_reset", { serverId, stage });
        setResetting(true);
        profileEpoch.current += 1;
        clearSteps();
        setStage("greeting");
        setProfile(null);
        setBookProgress(null);
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
        else if (s.type === "checkpoint") setStage("checkpoint");
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
                            track("onboarding_name_submitted", { serverId });
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
                            track("onboarding_book_uploaded", {
                                serverId,
                                filename: profile?.bookFilename,
                            });
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

            case "checkpoint": {
                if (!activeCheckpoint) {
                    if (bookProgress?.status === "checkpoint" && bookProgress?.checkpointStep) {
                        try {
                            const parsed = bookProgress.checkpointData
                                ? (typeof bookProgress.checkpointData === "string"
                                    ? JSON.parse(bookProgress.checkpointData)
                                    : bookProgress.checkpointData)
                                : {};
                            activateCheckpoint(bookProgress.checkpointStep, {
                                ...parsed,
                                step:        bookProgress.checkpointStep,
                                advance_url: `${OTTO_API}/onboarding/${serverId}/advance`,
                            });
                        } catch { }
                    }
                    return <EmptyState>Waiting for review…</EmptyState>;
                }
                const onCheckpointDone = () => {
                    markDone(activeCheckpoint.id);
                    const nextCheckpoint = steps.find(
                        s => s.type === "checkpoint" && s.needsAction && !s.done && s.id !== activeCheckpoint.id
                    );
                    setStage(nextCheckpoint ? "checkpoint" : "reviews");
                };
                if (activeCheckpoint.id === "checkpoint_character_review") {
                    return (
                        <CharacterReviewCheckpoint
                            step={activeCheckpoint}
                            jobId={bookProgress?.jobId ?? ""}
                            onDone={onCheckpointDone}
                        />
                    );
                }
                return (
                    <CheckpointStep
                        step={activeCheckpoint}
                        channelId={channelId}
                        onDone={onCheckpointDone}
                    />
                );
            }

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
                                track("onboarding_review_submitted", { serverId, rating: reviewValues.rating ?? "" });
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
                        <ConfirmHeading>Your studio is ready</ConfirmHeading>
                        {bookProgress?.portraitsUrl || bookProgress?.sceneStillsUrl ? (
                            <ConfirmBody style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                                <span>Processing complete. Your book world is live.</span>
                                {bookProgress.portraitsUrl && (
                                    <a href={bookProgress.portraitsUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ color: "#2980b9", textDecoration: "underline" }}>
                                        View character portraits
                                    </a>
                                )}
                                {bookProgress.sceneStillsUrl && (
                                    <a href={bookProgress.sceneStillsUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ color: "#2980b9", textDecoration: "underline" }}>
                                        View scene stills
                                    </a>
                                )}
                            </ConfirmBody>
                        ) : (
                            <ConfirmBody>Processing complete. Portraits and scene stills will appear here shortly.</ConfirmBody>
                        )}
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
                            <CloseBtn onClick={() => { track("wizard_closed", { serverId, stage }); onClose(); }}>×</CloseBtn>
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
                    {(() => {
                        const stepIdx = bookProgress?.currentStep
                            ? PIPELINE_STEPS.indexOf(bookProgress.currentStep as any)
                            : -1;
                        let progressFraction: number;
                        if (bookProgress?.status === "complete") {
                            progressFraction = 0.99;
                        } else if (stepIdx >= 0) {
                            progressFraction = (stepIdx + 1) / PIPELINE_STEPS.length;
                            lastProgressRef.current = progressFraction;
                        } else if (!bookProgress || bookProgress.currentStep === "starting") {
                            progressFraction = 0;
                        } else {
                            progressFraction = lastProgressRef.current;
                        }
                        return (
                            <PipelineBar
                                $active={!!bookProgress && bookProgress.status !== "error" || steps.some(s => s.type === "processing")}
                                $progress={progressFraction}
                            />
                        );
                    })()}
                </Shell>
                {canNext && (
                    <DomeBtn $side="right" onClick={goToReviews} title="Add Reviews">›</DomeBtn>
                )}
            </ModalWrapper>
        </Overlay>
    );
}
