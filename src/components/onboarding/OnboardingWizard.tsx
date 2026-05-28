import { useState, useCallback, useEffect, useRef, useReducer } from "preact/hooks";
import { createPortal } from "preact/compat";
import { EditAlt, Bulb, Refresh } from "@styled-icons/boxicons-regular";
import styled from "styled-components/macro";
import { track, identify } from "../../lib/analytics";

import { uploadFile } from "../../controllers/client/jsx/legacy/FileUploads";
import { useClient } from "../../controllers/client/ClientController";
import { ModalProps } from "../../controllers/modals/types";

import SubwayMap from "./SubwayMap";
import { useMessageParser, makeFixedSteps, WizardStep } from "./useOnboardingMessages";

// ── pipeline step registry ────────────────────────────────────────────────────

const PIPELINE_STEPS = [
    "extract", "tokenize", "scene_builder", "chunk",
    "embed", "embed_paragraphs", "summarize",
    "scene_enrich_labels", "scene_enrich_gliner",
    "gliner", "character_roster",
    "booknlp", "detect_narration", "character_dialog",
    "build_graph", "prune_graph", "drop_bg_characters",
    "character_appearance", "describe_characters",
    "prune_using_descriptions", "roster_with_descriptions", "refine_roster",
    "character_review",
    "character_portraits", "scene_stills",
] as const;

const STEP_LABELS: Partial<Record<typeof PIPELINE_STEPS[number], string>> = {
    extract:                  "Extracting text",
    tokenize:                 "Tokenizing",
    scene_builder:            "Building scenes",
    chunk:                    "Chunking",
    embed:                    "Embedding",
    embed_paragraphs:         "Indexing paragraphs",
    summarize:                "Summarizing scenes",
    scene_enrich_labels:      "Labeling scenes",
    scene_enrich_gliner:      "Enriching scenes",
    gliner:                   "Finding entities",
    character_roster:         "Building character roster",
    booknlp:                  "Running BookNLP",
    detect_narration:         "Detecting narration",
    character_dialog:         "Analyzing dialog",
    build_graph:              "Building character graph",
    prune_graph:              "Pruning graph",
    drop_bg_characters:       "Dropping background characters",
    character_appearance:     "Analyzing appearance",
    describe_characters:      "Describing characters",
    prune_using_descriptions: "Refining with descriptions",
    roster_with_descriptions: "Building final roster",
    refine_roster:            "Refining roster",
    character_review:         "Preparing cast review",
    character_portraits:      "Generating portraits",
    scene_stills:             "Generating scene stills",
};

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
const EntityTag = styled.span<{ $color: string }>`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${p => p.$color};
    background: ${p => p.$color}22;
    border: 1px solid ${p => p.$color}55;
    border-radius: 20px;
    padding: 1px 7px;
    flex-shrink: 0;
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

const TypingDots = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 40px 0;
    span {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgba(255,255,255,0.25);
        animation: dotpulse 1.2s ease-in-out infinite;
        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
    }
    @keyframes dotpulse {
        0%, 80%, 100% { opacity: 0.25; transform: scale(1); }
        40%            { opacity: 0.7;  transform: scale(1.3); }
    }
`;

function WaitingDots() {
    return <TypingDots><span/><span/><span/></TypingDots>;
}

const StepTicker = styled.div`
    padding: 5px 26px 7px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    flex-shrink: 0;
`;

const MiniSpinner = styled.div`
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(255,255,255,0.1);
    border-top-color: #F4B978;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    @keyframes spin { to { transform: rotate(360deg); } }
    flex-shrink: 0;
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

const DebugChip = styled.div`
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-family: monospace;
    color: rgba(255,255,255,0.25);
    background: rgba(0,0,0,0.35);
    border-radius: 4px;
    padding: 2px 8px;
    z-index: 9999;
    white-space: nowrap;
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
    serverId,
    onDone,
    onSkip,
}: {
    step: WizardStep;
    channelId: string;
    serverId: string;
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
            onDone({ ...values, _filename: uploadFile_?.name ?? "" });
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
    serverId,
    onDone,
}: {
    step: WizardStep;
    channelId: string;
    serverId: string;
    onDone: () => void;
}) {
    const client = useClient();
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(step.done);

    const data = step.data;
    const advanceUrl: string | undefined = data?.advance_url;

    type CharEntry = { name: string; role: "Main" | "Supporting" | "Minor" };
    const [chars, setChars] = useState<CharEntry[]>(() =>
        (data?.characters ?? [])
            .filter((c: any) => c.role !== "Background")
            .map((c: any) => ({ name: c.name as string, role: c.role as "Main" | "Supporting" | "Minor" }))
    );

    const [checked, setChecked] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(chars.map(c => [c.name, true]))
    );
    const toggle = (name: string) => setChecked(prev => ({ ...prev, [name]: !prev[name] }));
    const remove = (name: string, e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        setChars(prev => prev.filter(c => c.name !== name));
        track("roster_character_removed", { serverId, name });
    };

    async function handleConfirm() {
        if (confirming || confirmed) return;
        setConfirming(true);
        try {
            if (advanceUrl) {
                await fetch(advanceUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ characters: chars }),
                });
            } else {
                const ch = (client as any)?.channels?.get(channelId);
                await ch?.sendMessage({ content: "confirmed" });
            }
            track("onboarding_checkpoint_submitted", {
                serverId,
                checkpointStep: data?.step ?? step.id,
                approvedCount: chars.length,
            });
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
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <CheckpointTitle style={{ marginBottom: 0 }}>Your Cast</CheckpointTitle>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#65e572", background: "rgba(101,229,114,0.1)", border: "1px solid rgba(101,229,114,0.28)", borderRadius: 20, padding: "2px 9px" }}>✓ Confirmed</span>
                </div>
                <CharScrollList>
                    {chars.map(({ name, role }) => (
                        <CharRow key={name}>
                            <CharRowName>{name}</CharRowName>
                            <CharRoleTag $role={role}>{role}</CharRoleTag>
                        </CharRow>
                    ))}
                </CharScrollList>
            </div>
        );
    }

    return (
        <div>
            <CheckpointTitle>Please confirm your Cast</CheckpointTitle>
            <CheckpointSub>
                {chars.length} characters identified. Remove anyone who shouldn't be included.
            </CheckpointSub>

            <CharScrollList>
                {chars.map(({ name, role }) => (
                    <CharRow key={name}>
                        <CharRowName>{name}</CharRowName>
                        <CharRoleTag $role={role}>{role}</CharRoleTag>
                        <button
                            onClick={(e: any) => remove(name, e)}
                            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, marginLeft: "auto" }}
                            title="Remove"
                        >✕</button>
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

function CharacterReviewCheckpoint({ step, jobId, serverId, onDone }: {
    step: WizardStep;
    jobId: string;
    serverId: string;
    onDone: () => void;
}) {
    type CharAppearanceEntry = { introduction?: string; imagePrompt?: string };
    type CharEntry = {
        name: string;
        role: string;
        description: string;
        entityType?: string;
        portraitUrl?: string;
        appearance?: CharAppearanceEntry;
    };

    const ENTITY_LABELS: Record<string, string> = { animal: "Animal", mythological: "Mythological", other: "Other" };
    const ENTITY_COLORS: Record<string, string> = { animal: "#f59e0b", mythological: "#8b5cf6", other: "#6b7280" };

    const data = step.data;
    const initial: CharEntry[] = (data?.characters ?? []).map((c: any) => ({
        name:        c.name ?? "",
        role:        c.role ?? "Supporting",
        description: c.description ?? "",
        entityType:  c.entityType,
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
                serverId,
                checkpointStep: step?.data?.step ?? "character_review",
                approvedCount:  chars.length,
            });
            onDone();
        } finally {
            setConfirming(false);
        }
    }

    if (step.done) {
        return (
            <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <CheckpointTitle style={{ marginBottom: 0 }}>Your Cast</CheckpointTitle>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#65e572", background: "rgba(101,229,114,0.1)", border: "1px solid rgba(101,229,114,0.28)", borderRadius: 20, padding: "2px 9px" }}>✓ Confirmed</span>
                </div>
                <RosterList>
                    {chars.map((c, i) => (
                        <RosterRow key={i}>
                            <RosterRowHeader>
                                <RosterRowName>{c.name}</RosterRowName>
                                <CharRoleTag $role={c.role}>{c.role}</CharRoleTag>
                                {c.entityType && c.entityType !== "person" && ENTITY_COLORS[c.entityType] && (
                                    <EntityTag $color={ENTITY_COLORS[c.entityType]}>{ENTITY_LABELS[c.entityType] ?? c.entityType}</EntityTag>
                                )}
                            </RosterRowHeader>
                            {c.description && <RosterRowDesc>{c.description}</RosterRowDesc>}
                        </RosterRow>
                    ))}
                </RosterList>
            </>
        );
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
                            {c.entityType && c.entityType !== "person" && ENTITY_COLORS[c.entityType] && (
                                <EntityTag $color={ENTITY_COLORS[c.entityType]}>{ENTITY_LABELS[c.entityType] ?? c.entityType}</EntityTag>
                            )}
                            <RosterRowBtn
                                onClick={() => setEditIdx(i)}
                                style={{ color: "#F5A623" }}
                                title="Edit"
                            >
                                <EditAlt size={13} />
                            </RosterRowBtn>
                            <RosterRowBtn
                                onClick={() => {
                                    track("cast_character_removed", { serverId, name: c.name, jobId });
                                    setChars(prev => prev.filter((_, j) => j !== i));
                                }}
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
                    onSave={(name, role, description) => {
                        track("cast_character_edited", { serverId, name, jobId });
                        setChars(prev => prev.map((c, i) => i === editIdx ? { ...c, name, role, description } : c));
                    }}
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
                        if (name) {
                            track("cast_character_added", { serverId, name, jobId });
                            setChars(prev => [...prev, { name, role, description }]);
                        }
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

// ── Portrait gallery ──────────────────────────────────────────────────────────

const GalleryGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
    margin-top: 4px;
`;
const GalleryCard = styled.div`
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    display: flex;
    flex-direction: column;
`;
const GalleryImg = styled.img`
    width: 100%;
    aspect-ratio: 2/3;
    object-fit: cover;
    object-position: center top;
    display: block;
    background: rgba(255,255,255,0.04);
`;
const GalleryImgPlaceholder = styled.div`
    width: 100%;
    aspect-ratio: 2/3;
    background: rgba(255,255,255,0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    color: rgba(255,255,255,0.15);
`;
const GalleryName = styled.div`
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    padding: 6px 8px 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
const GalleryRole = styled.div`
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(255,255,255,0.3);
    padding: 0 8px 7px;
`;
const SceneGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin-top: 4px;
`;
const SceneCard = styled.div`
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
`;
const SceneImg = styled.img`
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
    display: block;
    background: rgba(255,255,255,0.04);
`;
const SceneLabel = styled.div`
    font-size: 10px;
    color: rgba(255,255,255,0.45);
    padding: 5px 8px 7px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
const GalleryTitle = styled.div`
    font-size: 17px;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    margin-bottom: 14px;
    letter-spacing: -0.01em;
`;

function PortraitGallery({ url, serverId, onContinue }: { url: string; serverId: string; onContinue?: () => void }) {
    const [chars, setChars] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(url)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(data => {
                const list = data?.characters ?? (Array.isArray(data) ? data : []);
                setChars(list);
                setLoading(false);
            });
    }, [url]);

    if (loading) return <ProcessWrap><Spinner /><span>Loading portraits…</span></ProcessWrap>;
    if (!chars.length) return <EmptyState>No portraits found.</EmptyState>;

    return (
        <div>
            <GalleryTitle>Character Portraits</GalleryTitle>
            <GalleryGrid>
                {chars.map((c: any, i: number) => (
                    <GalleryCard key={i}>
                        {c.portraitUrl
                            ? <GalleryImg src={c.portraitUrl} alt={c.name} loading="lazy" />
                            : <GalleryImgPlaceholder>👤</GalleryImgPlaceholder>}
                        <GalleryName title={c.name}>{c.name}</GalleryName>
                        <GalleryRole>{c.role}</GalleryRole>
                    </GalleryCard>
                ))}
            </GalleryGrid>
            {onContinue && (
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                    <SubmitBtn onClick={onContinue}>Continue →</SubmitBtn>
                </div>
            )}
        </div>
    );
}

function SceneStillsGallery({ url, serverId, onContinue }: { url: string; serverId: string; onContinue?: () => void }) {
    const [scenes, setScenes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(url)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(data => {
                const list = data?.scenes ?? data?.stills ?? (Array.isArray(data) ? data : []);
                setScenes(list);
                setLoading(false);
            });
    }, [url]);

    if (loading) return <ProcessWrap><Spinner /><span>Loading scene stills…</span></ProcessWrap>;
    if (!scenes.length) return <EmptyState>No scene stills found.</EmptyState>;

    return (
        <div>
            <GalleryTitle>Scene Stills</GalleryTitle>
            <SceneGrid>
                {scenes.map((s: any, i: number) => (
                    <SceneCard key={i}>
                        {s.imageUrl || s.url || s.still_url
                            ? <SceneImg src={s.imageUrl ?? s.url ?? s.still_url} alt={s.title ?? `Scene ${i+1}`} loading="lazy" />
                            : <GalleryImgPlaceholder style={{ aspectRatio: "16/9" }}>🎬</GalleryImgPlaceholder>}
                        {(s.title || s.description) && (
                            <SceneLabel title={s.title ?? s.description}>{s.title ?? s.description}</SceneLabel>
                        )}
                    </SceneCard>
                ))}
            </SceneGrid>
            {onContinue && (
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                    <SubmitBtn onClick={onContinue}>Continue →</SubmitBtn>
                </div>
            )}
        </div>
    );
}

// ── voice form ────────────────────────────────────────────────────────────────

const VoiceWrap = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 4px 2px 16px;
    max-height: 420px;
    overflow-y: auto;
`;

const VoiceSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const VoiceSectionHead = styled.div`
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--secondary-foreground);
    padding-bottom: 2px;
    border-bottom: 1px solid var(--secondary-header-secondary);
`;

const VoiceLabel = styled.label`
    font-size: 13px;
    color: var(--foreground);
    display: flex;
    flex-direction: column;
    gap: 5px;
`;

const VoiceTextarea = styled.textarea`
    background: var(--secondary-background);
    border: 1px solid var(--secondary-header-secondary);
    border-radius: 6px;
    color: var(--foreground);
    font-size: 13px;
    padding: 8px 10px;
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
    &:focus { outline: none; border-color: var(--accent); }
`;

const VoiceBtnRow = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 4px;
`;

interface VoiceValues {
    voice_description:   string;
    reader_feeling:      string;
    communication_style: string;
    instinctive_phrases: string;
    avoided_phrases:     string;
    stylistic_habits:    string;
    book_elevator_pitch: string;
    preferred_themes:    string;
    credential_style:    string;
    content_restrictions: string;
    voice_to_avoid:      string;
}

function VoiceFormStep({ serverId, onDone, onSkip }: {
    serverId: string | undefined;
    onDone: (values: VoiceValues) => void;
    onSkip: () => void;
}) {
    const [v, setV] = useState<VoiceValues>({
        voice_description: "", reader_feeling: "", communication_style: "",
        instinctive_phrases: "", avoided_phrases: "", stylistic_habits: "",
        book_elevator_pitch: "", preferred_themes: "", credential_style: "",
        content_restrictions: "", voice_to_avoid: "",
    });
    const set = (k: keyof VoiceValues) => (e: any) => setV(prev => ({ ...prev, [k]: e.target.value }));
    const hasAny = Object.values(v).some(s => s.trim().length > 0);

    return (
        <VoiceWrap>
            <VoiceSection>
                <VoiceSectionHead>Tone &amp; Personality</VoiceSectionHead>
                <VoiceLabel>
                    How would you describe your voice as a writer?
                    <VoiceTextarea value={v.voice_description} onInput={set("voice_description")}
                        placeholder="Spare, atmospheric, witty, intense…" />
                </VoiceLabel>
                <VoiceLabel>
                    What do you want readers to feel when they encounter you online?
                    <VoiceTextarea value={v.reader_feeling} onInput={set("reader_feeling")}
                        placeholder="Curious, unsettled, entertained…" />
                </VoiceLabel>
                <VoiceLabel>
                    How do you naturally communicate — direct and brief, or expansive?
                    <VoiceTextarea value={v.communication_style} onInput={set("communication_style")}
                        placeholder="Brief and punchy / layered and detailed / uses a lot of humor…" />
                </VoiceLabel>
            </VoiceSection>

            <VoiceSection>
                <VoiceSectionHead>Vocabulary &amp; Phrasing</VoiceSectionHead>
                <VoiceLabel>
                    Words or phrases you use instinctively?
                    <VoiceTextarea value={v.instinctive_phrases} onInput={set("instinctive_phrases")}
                        placeholder="Sentence starters, favorite words, regional phrasing…" />
                </VoiceLabel>
                <VoiceLabel>
                    Words or phrases you would never use?
                    <VoiceTextarea value={v.avoided_phrases} onInput={set("avoided_phrases")}
                        placeholder="Marketing clichés, slang that feels off-brand…" />
                </VoiceLabel>
                <VoiceLabel>
                    Any intentional stylistic habits? (contractions, fragments, etc.)
                    <VoiceTextarea value={v.stylistic_habits} onInput={set("stylistic_habits")}
                        placeholder="Always use contractions / never use em-dashes…" />
                </VoiceLabel>
            </VoiceSection>

            <VoiceSection>
                <VoiceSectionHead>How You Talk About Your Work</VoiceSectionHead>
                <VoiceLabel>
                    How do you describe your books to a friend (not a press kit)?
                    <VoiceTextarea value={v.book_elevator_pitch} onInput={set("book_elevator_pitch")}
                        placeholder="What you'd say at a party when someone asks…" />
                </VoiceLabel>
                <VoiceLabel>
                    Which themes in your work do you most enjoy discussing publicly?
                    <VoiceTextarea value={v.preferred_themes} onInput={set("preferred_themes")}
                        placeholder="Identity, power, memory…" />
                </VoiceLabel>
                <VoiceLabel>
                    How do you talk about your credentials or authority?
                    <VoiceTextarea value={v.credential_style} onInput={set("credential_style")}
                        placeholder="Lead with expertise / let the work speak…" />
                </VoiceLabel>
            </VoiceSection>

            <VoiceSection>
                <VoiceSectionHead>Guardrails</VoiceSectionHead>
                <VoiceLabel>
                    Any topics or content you never want associated with your public presence?
                    <VoiceTextarea value={v.content_restrictions} onInput={set("content_restrictions")}
                        placeholder="Political topics, personal subjects, anything off-limits…" />
                </VoiceLabel>
                <VoiceLabel>
                    What version of your author voice are you trying to avoid?
                    <VoiceTextarea value={v.voice_to_avoid} onInput={set("voice_to_avoid")}
                        placeholder="Overly promotional / too academic / too casual…" />
                </VoiceLabel>
            </VoiceSection>

            <VoiceBtnRow>
                <SecondaryBtn onClick={onSkip}>Skip for now</SecondaryBtn>
                <SubmitBtn onClick={() => onDone(v)} $disabled={!hasAny} disabled={!hasAny}>
                    Save &amp; Continue
                </SubmitBtn>
            </VoiceBtnRow>
        </VoiceWrap>
    );
}

// ── state machine ─────────────────────────────────────────────────────────────

type Stage = "greeting" | "upload" | "waiting" | "checkpoint" | "portraits" | "scenes" | "voice" | "done";

const OTTO_API = "https://otto.apricotter.com";

// ── reducer ───────────────────────────────────────────────────────────────────

type WizardState = {
    profile:              any | null;
    bookProgress:         BookProgress | null;
    stage:                Stage;
    checkpointId:         string | null;
    confirmedCheckpoints: Set<string>;
    steps:                WizardStep[];
    processingSteps:      WizardStep[];
    invitationName:       string;
    reviewsDone:          boolean;
    reviewKey:            number;
    localReviewCount:     number;
    voiceDone:            boolean;
};

type WizardAction =
    | { type: "PROFILE_LOADED";        profile: any; serverId: string }
    | { type: "BOOK_PROGRESS_UPDATED"; progress: BookProgress; serverId: string }
    | { type: "INVITATION_LOADED";     name: string }
    | { type: "STEP_ACTIVATED";        stepId: string; data: any; messageId?: string }
    | { type: "STEP_DONE";             stepId: string }
    | { type: "PROCESSING_STEP";       step: WizardStep }
    | { type: "NAME_SUBMITTED" }
    | { type: "BOOK_UPLOADED" }
    | { type: "REVIEW_ADDED" }
    | { type: "ADD_ANOTHER_REVIEW" }
    | { type: "CHECKPOINT_CONFIRMED";  checkpointId: string }
    | { type: "PORTRAITS_CONTINUE" }
    | { type: "SCENES_CONTINUE" }
    | { type: "VOICE_SUBMITTED" }
    | { type: "NAVIGATE_TO";           stage: Stage; checkpointId?: string }
    | { type: "BOOKS_CLEARED" }
    | { type: "RESET" };

function patchStep(steps: WizardStep[], id: string, patch: Partial<WizardStep>): WizardStep[] {
    return steps.map(s => s.id === id ? { ...s, ...patch } : s);
}

function stageOrder(s: Stage): number {
    return (["greeting", "upload", "waiting", "checkpoint", "portraits", "scenes", "voice", "done"] as Stage[]).indexOf(s);
}

function parseRawCheckpointData(raw: any): any {
    if (!raw) return {};
    if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
    return raw;
}

const initialState: WizardState = {
    profile:              null,
    bookProgress:         null,
    stage:                "greeting",
    checkpointId:         null,
    confirmedCheckpoints: new Set(),
    steps:                makeFixedSteps(),
    processingSteps:      [],
    invitationName:       "",
    reviewsDone:          false,
    reviewKey:            0,
    localReviewCount:     0,
    voiceDone:            false,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {

        case "PROFILE_LOADED": {
            const p = action.profile;
            const lastBook: BookProgress | undefined = p.books?.[p.books.length - 1];
            let steps = state.steps;
            const voiceDone = !!p.voice;
            if (p.authorName)               steps = patchStep(steps, "greeting",  { done: true });
            if (p.bookFilename || lastBook)  steps = patchStep(steps, "form_book", { done: true });
            if (voiceDone)                   steps = patchStep(steps, "form_voice", { done: true });

            let stage: Stage     = "greeting";
            let checkpointId     = state.checkpointId;

            if (lastBook?.sceneStillsUrl) {
                steps = patchStep(steps, "milestone_portraits", { done: true, data: { url: lastBook.portraitsUrl ?? "" } });
                steps = patchStep(steps, "milestone_scenes",    { done: true, data: { url: lastBook.sceneStillsUrl } });
                const cpParsed = parseRawCheckpointData(lastBook.checkpointData);
                steps = patchStep(steps, "checkpoint_character_review", {
                    done: true, needsAction: false,
                    ...(cpParsed?.characters?.length ? { data: { ...cpParsed, step: "character_review", advance_url: `${OTTO_API}/onboarding/${action.serverId}/advance` } } : {}),
                });
                stage = "scenes";
            } else if (lastBook?.portraitsUrl) {
                steps = patchStep(steps, "milestone_portraits", { done: true, data: { url: lastBook.portraitsUrl } });
                const cpParsed = parseRawCheckpointData(lastBook.checkpointData);
                steps = patchStep(steps, "checkpoint_character_review", {
                    done: true, needsAction: false,
                    ...(cpParsed?.characters?.length ? { data: { ...cpParsed, step: "character_review", advance_url: `${OTTO_API}/onboarding/${action.serverId}/advance` } } : {}),
                });
                stage = "portraits";
            } else if (lastBook?.status === "checkpoint" && lastBook.checkpointStep) {
                const targetId = `checkpoint_${lastBook.checkpointStep}`;
                if (!state.confirmedCheckpoints.has(targetId)) {
                    const parsed   = parseRawCheckpointData(lastBook.checkpointData);
                    const existing = steps.find(s => s.id === targetId);
                    const merged   = parsed?.characters?.length
                        ? { ...parsed }
                        : { ...(existing?.data ?? {}), ...parsed };
                    steps = patchStep(steps, targetId, {
                        data: { ...merged, step: lastBook.checkpointStep, advance_url: `${OTTO_API}/onboarding/${action.serverId}/advance` },
                        needsAction: true,
                    });
                    checkpointId = targetId;
                    stage = "checkpoint";
                } else {
                    stage = "waiting";
                }
            } else if (lastBook?.status === "complete" || lastBook?.status === "cancelled" || lastBook?.status === "error") {
                stage = voiceDone ? "done" : "voice";
            } else if (lastBook) {
                stage = "waiting";
            } else if (p.authorName) {
                stage = "upload";
            }

            return {
                ...state,
                profile:          p,
                bookProgress:     lastBook ?? state.bookProgress,
                steps,
                stage,
                checkpointId,
                reviewsDone:      (p.reviews?.length ?? 0) > 0,
                localReviewCount: p.reviews?.length ?? 0,
                voiceDone,
            };
        }

        case "BOOK_PROGRESS_UPDATED": {
            const prog = action.progress;
            let steps        = state.steps;
            let stage        = state.stage;
            let checkpointId = state.checkpointId;

            if (prog.portraitsUrl)
                steps = patchStep(steps, "milestone_portraits", { done: true, data: { url: prog.portraitsUrl } });
            if (prog.sceneStillsUrl)
                steps = patchStep(steps, "milestone_scenes", { done: true, data: { url: prog.sceneStillsUrl } });

            const isTerminal = prog.status === "complete" || prog.status === "cancelled" || prog.status === "error";

            // Self-heal: mark character_review done if pipeline moved past it
            const curIdx = isTerminal
                ? PIPELINE_STEPS.length
                : PIPELINE_STEPS.indexOf(prog.currentStep as any);
            if (curIdx > PIPELINE_STEPS.indexOf("character_review"))
                steps = patchStep(steps, "checkpoint_character_review", { done: true, needsAction: false });

            // Server always drives forward; checkpoint is a hard interrupt.
            // Guard: only activate if we're past upload — a checkpoint while at greeting/upload
            // is a stale poll from the previous run (race with cancel after Start Over).
            if (prog.status === "checkpoint" && prog.checkpointStep
                && stageOrder(state.stage) >= stageOrder("waiting")) {
                const targetId = `checkpoint_${prog.checkpointStep}`;
                if (!state.confirmedCheckpoints.has(targetId)) {
                    const parsed   = parseRawCheckpointData(prog.checkpointData);
                    const existing = steps.find(s => s.id === targetId);
                    // Preserve existing character data from STEP_ACTIVATED (channel message) if the
                    // API poll returns empty checkpointData — polls fire every 5s and would otherwise
                    // wipe the character list the message parser already set.
                    const merged = parsed?.characters?.length
                        ? { ...parsed }
                        : { ...(existing?.data ?? {}), ...parsed };
                    steps = patchStep(steps, targetId, {
                        data: { ...merged, step: prog.checkpointStep, advance_url: `${OTTO_API}/onboarding/${action.serverId}/advance` },
                        needsAction: true,
                    });
                    checkpointId = targetId;
                    stage = "checkpoint";
                }
            } else if (isTerminal && prog.status === "cancelled") {
                // Cancelled job (reset/start-over) — don't drive stage forward
            } else if (isTerminal && prog.sceneStillsUrl) {
                stage = stageOrder(stage) >= stageOrder("scenes") ? stage : "scenes";
            } else if (isTerminal && prog.portraitsUrl) {
                stage = stageOrder(stage) >= stageOrder("portraits") ? stage : "portraits";
            } else if (isTerminal) {
                stage = state.voiceDone ? "done" : "voice";
            } else if (prog.sceneStillsUrl && stage === "waiting") {
                stage = "scenes";
            } else if (prog.portraitsUrl && stage === "waiting") {
                stage = "portraits";
            } else if (prog.status === "running" && !prog.sceneStillsUrl && !prog.portraitsUrl
                       && (stage === "portraits" || stage === "scenes" || stage === "voice" || stage === "done")) {
                stage = "waiting";  // restart snap-back (only when URLs are cleared)
            } else if (prog.status === "running" && stageOrder(stage) < stageOrder("waiting")) {
                stage = "waiting";
            }

            return { ...state, bookProgress: prog, steps, stage, checkpointId };
        }

        case "INVITATION_LOADED":
            return { ...state, invitationName: action.name };

        case "STEP_ACTIVATED": {
            const steps = state.steps.map(s =>
                s.id === action.stepId
                    ? { ...s, data: action.data, needsAction: s.type === "checkpoint", ...(action.messageId ? { messageId: action.messageId } : {}) }
                    : s
            );
            return { ...state, steps };
        }

        case "STEP_DONE":
            return { ...state, steps: patchStep(state.steps, action.stepId, { done: true, needsAction: false }) };

        case "PROCESSING_STEP": {
            const idx = state.processingSteps.findIndex(s => s.id === action.step.id);
            const processingSteps = idx >= 0
                ? state.processingSteps.map((s, i) => i === idx ? action.step : s)
                : [...state.processingSteps, action.step];
            return { ...state, processingSteps };
        }

        case "NAME_SUBMITTED":
            return { ...state, stage: "upload", steps: patchStep(state.steps, "greeting", { done: true }) };

        case "BOOK_UPLOADED":
            return { ...state, stage: "waiting", steps: patchStep(state.steps, "form_book", { done: true }) };

        case "REVIEW_ADDED":
            return {
                ...state,
                reviewsDone:      true,
                reviewKey:        state.reviewKey + 1,
                localReviewCount: state.localReviewCount + 1,
                steps: patchStep(state.steps, "form_author", { done: true }),
            };

        case "ADD_ANOTHER_REVIEW":
            return { ...state, reviewsDone: false, reviewKey: state.reviewKey + 1 };

        case "CHECKPOINT_CONFIRMED": {
            const confirmed = new Set(state.confirmedCheckpoints);
            confirmed.add(action.checkpointId);
            return {
                ...state,
                confirmedCheckpoints: confirmed,
                checkpointId:         null,
                stage:                "waiting",
                steps: patchStep(state.steps, action.checkpointId, { done: true, needsAction: false }),
            };
        }

        case "PORTRAITS_CONTINUE":
            return { ...state, stage: state.bookProgress?.sceneStillsUrl ? "scenes" : "voice" };

        case "SCENES_CONTINUE":
            return { ...state, stage: "voice" };

        case "VOICE_SUBMITTED":
            return {
                ...state,
                voiceDone: true,
                stage:     "done",
                steps:     patchStep(state.steps, "form_voice", { done: true }),
            };

        case "NAVIGATE_TO":
            return {
                ...state,
                stage: action.stage,
                ...(action.checkpointId !== undefined ? { checkpointId: action.checkpointId } : {}),
            };

        case "BOOKS_CLEARED":
            return {
                ...initialState,
                profile:        state.profile,
                invitationName: state.invitationName,
                steps:          patchStep(makeFixedSteps(), "greeting", { done: true }),
                stage:          "upload",
            };

        case "RESET":
            return { ...initialState, invitationName: state.invitationName };

        default:
            return state;
    }
}

export default function OnboardingWizard({
    channelId,
    serverId,
    onClose,
}: ModalProps<"author_onboarding">) {
    const client = useClient();
    const [state, dispatch] = useReducer(wizardReducer, initialState);
    const [resetting, setResetting] = useState(false);

    const {
        stage, steps, processingSteps, bookProgress, profile,
        invitationName, reviewsDone, reviewKey, localReviewCount, checkpointId, voiceDone,
    } = state;

    const lastStepRef             = useRef<string | null>(null);
    const lastAnnouncedCheckpoint = useRef<string | null>(null);
    const lastViewedCheckpoint    = useRef<string | null>(null);
    const lastViewedMilestone     = useRef<string | null>(null);
    const lastProgressRef         = useRef(0);
    const highestStepIdxRef       = useRef(-1);

    useMessageParser(channelId, dispatch);

    // Effect 1: load profile on mount
    useEffect(() => {
        if (!serverId) return;
        fetch(`${OTTO_API}/onboarding/${serverId}/profile`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(p => { if (p) dispatch({ type: "PROFILE_LOADED", profile: p, serverId: serverId! }); });
    }, [serverId]);

    // Effect 2: fetch invitation name
    useEffect(() => {
        const apiUrl = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/$/, "");
        const token = (client as any)?.session?.token;
        if (!token) return;
        fetch(`${apiUrl}/users/@me/invitation`, { headers: { "x-session-token": token } })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(inv => {
                if (!inv?.metadata) return;
                const raw = inv.metadata.name ?? inv.metadata.ownerName ?? "";
                const name = raw.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()).trim();
                if (name) dispatch({ type: "INVITATION_LOADED", name });
            });
    }, []);

    // Effect 3: poll book progress
    const fetchBookProgress = useCallback(() => {
        if (!serverId) return;
        fetch(`${OTTO_API}/onboarding/${serverId}/profile`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(p => {
                if (!p) return;
                if (p.exists === false || p.resetNeeded) {
                    track("onboarding_reset_detected", { serverId });
                    dispatch({ type: "BOOKS_CLEARED" });
                    if (p.resetNeeded) {
                        fetch(`${OTTO_API}/onboarding/${serverId}/ack-reset`, { method: "POST" }).catch(() => {});
                    }
                    return;
                }
                const prog: BookProgress | undefined = p?.books?.[p.books.length - 1];
                if (prog) dispatch({ type: "BOOK_PROGRESS_UPDATED", progress: prog, serverId: serverId! });
            });
    }, [serverId]);

    useEffect(() => {
        if (!bookProgress) return;
        const active = bookProgress.status === "running" || bookProgress.status === "checkpoint";
        const id = setInterval(fetchBookProgress, active ? 5000 : 15000);
        return () => clearInterval(id);
    }, [bookProgress?.status, fetchBookProgress]);

    // Always poll for reset signal even when no active job
    useEffect(() => {
        if (!serverId) return;
        const id = setInterval(fetchBookProgress, 10000);
        return () => clearInterval(id);
    }, [serverId, fetchBookProgress]);

    // Effect 4: stage side effects — analytics, persist, complete
    const persistWizardStep = useCallback((stepId: string) => {
        if (!serverId) return;
        fetch(`${OTTO_API}/onboarding/${serverId}/wizard-step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stepId }),
        }).catch(() => {});
    }, [serverId]);

    useEffect(() => {
        if (stage === "done" && serverId) {
            track("onboarding_completed", { serverId, bookSlug: bookProgress?.slug });
            fetch(`${OTTO_API}/onboarding/${serverId}/complete`, { method: "POST" }).catch(() => {});
        }
        if (stage !== "greeting") persistWizardStep(stage);
    }, [stage]);

    useEffect(() => {
        if (stage !== "portraits" && stage !== "scenes") return;
        if (stage === lastViewedMilestone.current) return;
        lastViewedMilestone.current = stage;
        track("milestone_viewed", { serverId, milestone: stage });
    }, [stage]);

    // Analytics
    useEffect(() => {
        if (!bookProgress?.currentStep) return;
        if (bookProgress.currentStep === lastStepRef.current) return;
        lastStepRef.current = bookProgress.currentStep;
        track("pipeline_step_completed", {
            serverId,
            step:      bookProgress.currentStep,
            stepIndex: PIPELINE_STEPS.indexOf(bookProgress.currentStep as any),
            jobId:     bookProgress.jobId,
            bookSlug:  bookProgress.slug,
        });
    }, [bookProgress?.currentStep]);

    useEffect(() => {
        if (stage !== "checkpoint" || !checkpointId) return;
        if (checkpointId === lastViewedCheckpoint.current) return;
        lastViewedCheckpoint.current = checkpointId;
        track("checkpoint_viewed", { serverId, checkpointStep: checkpointId });
    }, [stage, checkpointId]);

    useEffect(() => {
        if (!bookProgress?.checkpointStep) return;
        if (bookProgress.checkpointStep === lastAnnouncedCheckpoint.current) return;
        lastAnnouncedCheckpoint.current = bookProgress.checkpointStep;
        const parsed = parseRawCheckpointData(bookProgress.checkpointData);
        track("onboarding_checkpoint_reached", {
            serverId,
            checkpointStep: bookProgress.checkpointStep,
            characterCount: parsed?.characters?.length ?? 0,
        });
    }, [bookProgress?.checkpointStep]);

    useEffect(() => {
        if (!bookProgress || !serverId) return;
        identify(serverId, {
            bookSlug:       bookProgress.slug,
            bookStatus:     bookProgress.status,
            currentStep:    bookProgress.currentStep,
            checkpointStep: bookProgress.checkpointStep ?? null,
            jobId:          bookProgress.jobId,
            portraitsUrl:   bookProgress.portraitsUrl ?? null,
            sceneStillsUrl: bookProgress.sceneStillsUrl ?? null,
        });
    }, [bookProgress?.slug, bookProgress?.status, bookProgress?.currentStep,
        bookProgress?.checkpointStep, bookProgress?.jobId,
        bookProgress?.portraitsUrl, bookProgress?.sceneStillsUrl]);

    const hasUploadFormData = !!steps.find(s => s.id === "form_book")?.data;
    const uploadFormTracked = useRef(false);
    useEffect(() => {
        if (stage !== "upload") { uploadFormTracked.current = false; return; }
        if (!hasUploadFormData || uploadFormTracked.current) return;
        uploadFormTracked.current = true;
        track("onboarding_upload_form_visible", { serverId, stage });
    }, [stage, hasUploadFormData]);

    const handleReset = useCallback(async () => {
        if (resetting) return;
        track("wizard_reset", { serverId, stage });
        setResetting(true);
        dispatch({ type: "RESET" });
        persistWizardStep("");
        try {
            await fetch(`${OTTO_API}/onboarding/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId, serverId }),
            });
        } catch { /* ignore */ } finally {
            setResetting(false);
        }
    }, [channelId, serverId, resetting, stage]);

    // Derived values
    const greetingStep      = steps.find(s => s.id === "greeting");
    const uploadStep        = steps.find(s => s.id === "form_book");
    const reviewStep        = steps.find(s => s.id === "form_author");
    const voiceStep         = steps.find(s => s.id === "form_voice");
    const displayCheckpoint = checkpointId ? steps.find(s => s.id === checkpointId) : null;

    const subwayActiveIndex = (() => {
        if (stage === "greeting")  return steps.findIndex(s => s.id === "greeting");
        if (stage === "upload")    return steps.findIndex(s => s.id === "form_book");
        if (stage === "waiting") {
            if (!reviewsDone && reviewStep?.data) return steps.findIndex(s => s.id === "form_author");
            return steps.findIndex(s => s.id === "form_book");
        }
        if (stage === "checkpoint" && checkpointId) return steps.findIndex(s => s.id === checkpointId);
        if (stage === "portraits") return steps.findIndex(s => s.id === "milestone_portraits");
        if (stage === "scenes")    return steps.findIndex(s => s.id === "milestone_scenes");
        if (stage === "voice")     return steps.findIndex(s => s.id === "form_voice");
        if (stage === "done")      return steps.findIndex(s => s.id === "form_voice");
        return -1;
    })();

    function onSelectStep(index: number) {
        const s = steps[index];
        if (!s) return;
        track("subway_stop_clicked", { serverId, stepId: s.id, stepType: s.type, stepLabel: s.label, done: s.done });
        if (s.type === "milestone") {
            if (s.id === "milestone_portraits" && s.data?.url)
                dispatch({ type: "NAVIGATE_TO", stage: "portraits" });
            else if (s.id === "milestone_scenes" && s.data?.url)
                dispatch({ type: "NAVIGATE_TO", stage: "scenes" });
            return;
        }
        if (s.id === "greeting")
            dispatch({ type: "NAVIGATE_TO", stage: "greeting" });
        else if (s.id === "form_book")
            dispatch({ type: "NAVIGATE_TO", stage: uploadStep?.done ? "waiting" : "upload" });
        else if (s.type === "checkpoint")
            dispatch({ type: "NAVIGATE_TO", stage: "checkpoint", checkpointId: s.id });
        else if (s.id === "form_author")
            dispatch({ type: "NAVIGATE_TO", stage: "waiting" });
        else if (s.id === "form_voice")
            dispatch({ type: "NAVIGATE_TO", stage: "voice" });
    }

    const canPrev = stage !== "greeting";
    function prev() {
        if (stage === "upload")       dispatch({ type: "NAVIGATE_TO", stage: "greeting" });
        else if (stage === "waiting") dispatch({ type: "NAVIGATE_TO", stage: "upload" });
    }

    function renderContent() {
        if (steps.length === 0) return <WaitingDots />;

        switch (stage) {
            case "greeting":
                if (!greetingStep?.data) return <WaitingDots />;
                return (
                    <GreetingStep
                        data={greetingStep.data}
                        channelId={channelId}
                        prefillName={profile?.authorName || invitationName}
                        onDone={(name: string) => {
                            dispatch({ type: "NAME_SUBMITTED" });
                            track("onboarding_name_submitted", { serverId });
                            if (serverId) {
                                fetch(`${OTTO_API}/onboarding/${serverId}/name`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name }),
                                }).catch(() => {});
                            }
                        }}
                    />
                );

            case "upload":
                if (!uploadStep?.data) return <WaitingDots />;
                return (
                    <FormStep
                        step={uploadStep}
                        channelId={channelId}
                        serverId={serverId}
                        onDone={(values) => {
                            track("onboarding_book_uploaded", {
                                serverId,
                                filename: values?._filename ?? profile?.bookFilename,
                            });
                            dispatch({ type: "BOOK_UPLOADED" });
                            fetchBookProgress();
                        }}
                    />
                );

            case "waiting": {
                if (!reviewsDone && reviewStep?.data) {
                    return (
                        <FormStep
                            key={reviewKey}
                            step={reviewStep}
                            channelId={channelId}
                            serverId={serverId}
                            onSkip={() => dispatch({ type: "REVIEW_ADDED" })}
                            onDone={(reviewValues) => {
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
                                dispatch({ type: "REVIEW_ADDED" });
                            }}
                        />
                    );
                }
                if (reviewsDone) {
                    return (
                        <ConfirmCard>
                            <ConfirmIcon>★</ConfirmIcon>
                            <ConfirmHeading>Review added</ConfirmHeading>
                            <ConfirmBody>Add another review or wait for processing to complete.</ConfirmBody>
                            <SecondaryBtn onClick={() => dispatch({ type: "ADD_ANOTHER_REVIEW" })}>
                                Add another
                            </SecondaryBtn>
                        </ConfirmCard>
                    );
                }
                return (
                    <ConfirmCard>
                        <ConfirmIcon>📖</ConfirmIcon>
                        <ConfirmHeading>Your book is on its way</ConfirmHeading>
                        <ConfirmBody>Quill is processing it in the background.</ConfirmBody>
                    </ConfirmCard>
                );
            }

            case "checkpoint": {
                if (!displayCheckpoint || (!displayCheckpoint.data && !displayCheckpoint.done)) {
                    return bookProgress?.status === "running"
                        ? <ProcessWrap><Spinner /><span>Characters are being finalized…</span></ProcessWrap>
                        : <WaitingDots />;
                }
                const onCheckpointDone = () => {
                    dispatch({ type: "CHECKPOINT_CONFIRMED", checkpointId: displayCheckpoint.id });
                };
                if (displayCheckpoint.id === "checkpoint_character_review") {
                    return (
                        <CharacterReviewCheckpoint
                            step={displayCheckpoint}
                            jobId={bookProgress?.jobId ?? ""}
                            serverId={serverId}
                            onDone={onCheckpointDone}
                        />
                    );
                }
                return (
                    <CheckpointStep
                        step={displayCheckpoint}
                        channelId={channelId}
                        serverId={serverId}
                        onDone={onCheckpointDone}
                    />
                );
            }

            case "portraits": {
                const ms = steps.find(s => s.id === "milestone_portraits");
                if (!ms?.data?.url) return <EmptyState>Loading portraits…</EmptyState>;
                return (
                    <PortraitGallery
                        url={ms.data.url}
                        serverId={serverId}
                        onContinue={() => dispatch({ type: "PORTRAITS_CONTINUE" })}
                    />
                );
            }

            case "scenes": {
                const ms = steps.find(s => s.id === "milestone_scenes");
                if (!ms?.data?.url) return <EmptyState>Loading scenes…</EmptyState>;
                return (
                    <SceneStillsGallery
                        url={ms.data.url}
                        serverId={serverId}
                        onContinue={() => dispatch({ type: "SCENES_CONTINUE" })}
                    />
                );
            }

            case "voice":
                return (
                    <VoiceFormStep
                        serverId={serverId}
                        onDone={(values) => {
                            if (serverId) {
                                fetch(`${OTTO_API}/onboarding/${serverId}/voice`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(values),
                                }).catch(() => {});
                                track("onboarding_voice_submitted", { serverId });
                            }
                            dispatch({ type: "VOICE_SUBMITTED" });
                        }}
                        onSkip={() => dispatch({ type: "VOICE_SUBMITTED" })}
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

    const pipelineActive = !!bookProgress && bookProgress.status !== "error";
    const stepIdx = bookProgress?.currentStep
        ? PIPELINE_STEPS.indexOf(bookProgress.currentStep as any)
        : -1;
    let progressFraction: number;
    if (bookProgress?.status === "complete") {
        progressFraction = 0.99;
    } else if (stepIdx >= 0) {
        if (stepIdx > highestStepIdxRef.current) highestStepIdxRef.current = stepIdx;
        progressFraction = Math.max((stepIdx + 1) / PIPELINE_STEPS.length, lastProgressRef.current);
        lastProgressRef.current = progressFraction;
    } else if (!bookProgress || bookProgress.currentStep === "starting") {
        progressFraction = 0;
    } else {
        progressFraction = lastProgressRef.current;
    }
    const tickerStep = bookProgress?.currentStep;

    const debugChip = (
        <DebugChip>
            {[serverId, channelId, bookProgress?.jobId].filter(Boolean).join(" · ")}
        </DebugChip>
    );

    return (
        <>
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
                    {bookProgress?.status === "running" && tickerStep && !bookProgress.sceneStillsUrl && (
                        <StepTicker>
                            <MiniSpinner />
                            <span>{STEP_LABELS[tickerStep as typeof PIPELINE_STEPS[number]] ?? tickerStep}</span>
                        </StepTicker>
                    )}
                    <PipelineBar
                        $active={pipelineActive || processingSteps.some(s => !s.done)}
                        $progress={progressFraction}
                    />
                </Shell>
            </ModalWrapper>
        </Overlay>
        {createPortal(debugChip, document.body)}
        </>
    );
}
