import styled, { keyframes } from "styled-components/macro";
import { WizardStep } from "./useOnboardingMessages";

const MapWrap = styled.div`
    padding: 16px 22px 10px;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0;
`;

const LineRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0;
    padding-bottom: 20px;
    &:last-child { padding-bottom: 4px; }
`;

const LineLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    width: 58px;
    flex-shrink: 0;
`;

const Track = styled.div`
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
`;

const StopCol = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
`;

const flowAnim = keyframes`
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
`;

const Connector = styled.div<{ $done: boolean; $toActive: boolean; $color: string }>`
    flex: 1;
    height: 2px;
    min-width: 12px;
    transition: background 0.3s;

    ${p => p.$toActive ? `
        background: linear-gradient(
            to right,
            ${p.$color}88 0%,
            ${p.$color} 40%,
            #fff9 60%,
            ${p.$color} 80%,
            ${p.$color}88 100%
        );
        background-size: 200% 100%;
        animation: ${flowAnim.getName()} 1.6s linear infinite;
    ` : p.$done ? `
        background: ${p.$color};
    ` : `
        background: repeating-linear-gradient(
            to right,
            rgba(255,255,255,0.15) 0,
            rgba(255,255,255,0.15) 3px,
            transparent 3px,
            transparent 7px
        );
    `}
`;

const Stop = styled.button<{ $state: "done" | "active" | "pending" | "locked"; $color: string }>`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid ${p =>
        p.$state === "locked" ? "var(--tertiary-background)" : p.$color
    };
    background: ${p =>
        p.$state === "done"   ? p.$color :
        p.$state === "active" ? "var(--secondary-background)" :
        "transparent"
    };
    cursor: ${p => p.$state === "locked" ? "default" : "pointer"};
    flex-shrink: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    outline: none;
    padding: 0;
    &:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
`;

const StopDot = styled.div<{ $color: string }>`
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${p => p.$color};
`;

const NeedsYouDot = styled.div`
    position: absolute;
    top: -3px;
    right: -3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f87171;
    border: 1px solid var(--secondary-background);
`;

const TrailingTrack = styled.div`
    flex: 2;
    height: 2px;
    background: var(--tertiary-background);
    min-width: 20px;
    opacity: 0.4;
`;

// ── Progress bar (book-upload line) ──────────────────────────────────────────

const shimmer = keyframes`
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
`;

const ProgressWrap = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
`;

const ProgressBarOuter = styled.div`
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
    flex: 1;
`;

const ProgressBarInner = styled.div<{ $active: boolean; $color: string }>`
    height: 100%;
    border-radius: 2px;
    background: ${p => p.$active
        ? `linear-gradient(90deg, ${p.$color}88 0%, ${p.$color} 40%, #fff9 60%, ${p.$color} 80%, ${p.$color}88 100%)`
        : p.$color};
    background-size: ${p => p.$active ? "400px 100%" : "100% 100%"};
    animation: ${p => p.$active ? `${shimmer.getName()} 1.4s linear infinite` : "none"};
    width: ${p => p.$active ? "60%" : "100%"};
    transition: width 0.4s ease;
`;

const ProgressLabel = styled.div<{ $color: string }>`
    font-size: 9px;
    color: ${p => p.$color};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

// ─────────────────────────────────────────────────────────────────────────────

interface SubwayMapProps {
    steps: WizardStep[];
    activeIndex: number;
    onSelectStep: (index: number) => void;
    bookFilename?: string;
    reviewCount?: number;
}

interface LineConfig {
    id: "book" | "book-upload" | "author";
    label: string;
    color: string;
}

const LINES: LineConfig[] = [
    { id: "book",        label: "BOOK",   color: "#F5A623" },
    { id: "book-upload", label: "UPLOAD", color: "#F5A623" },
    { id: "author",      label: "AUTHOR", color: "#60a5fa" },
];

export default function SubwayMap({ steps, activeIndex, onSelectStep, bookFilename, reviewCount }: SubwayMapProps) {
    return (
        <MapWrap>
            {LINES.map(line => {
                const lineSteps = steps
                    .map((s, i) => ({ step: s, globalIndex: i }))
                    .filter(({ step }) => step.line === line.id);

                if (lineSteps.length === 0) return null;

                const lineIsActive = lineSteps.some(({ globalIndex }) => globalIndex === activeIndex);
                const lineHasDone  = lineSteps.some(({ step }) => step.done);
                if (!lineIsActive && !lineHasDone) return null;

                // book-upload line → compact progress bar
                if (line.id === "book-upload") {
                    const uploadStep     = lineSteps.find(({ step }) => step.type === "form");
                    const processingStep = lineSteps.find(({ step }) => step.type === "processing");
                    const isProcessing   = !!processingStep && !processingStep.step.done;
                    const currentLabel   = processingStep?.step.label ?? (uploadStep?.step.done ? "Uploaded" : "Upload");

                    return (
                        <LineRow key={line.id}>
                            <LineLabel>{line.label}</LineLabel>
                            <ProgressWrap>
                                <ProgressBarOuter>
                                    <ProgressBarInner $active={isProcessing} $color={line.color} />
                                </ProgressBarOuter>
                                {isProcessing && (
                                    <ProgressLabel $color={line.color}>{currentLabel}</ProgressLabel>
                                )}
                            </ProgressWrap>
                        </LineRow>
                    );
                }

                // book / author lines → subway dots, no labels
                return (
                    <LineRow key={line.id}>
                        <LineLabel>{line.label}</LineLabel>
                        <Track>
                            {lineSteps.map(({ step, globalIndex }, pos) => {
                                const state =
                                    step.done                    ? "done"    :
                                    globalIndex === activeIndex  ? "active"  :
                                    step.needsAction             ? "pending" :
                                    "locked";

                                return (
                                    <>
                                        {pos > 0 && (
                                            <Connector
                                                $done={lineSteps[pos - 1].step.done}
                                                $toActive={lineSteps[pos - 1].step.done && state === "active"}
                                                $color={line.color}
                                            />
                                        )}
                                        <StopCol key={step.id}>
                                            <Stop
                                                $state={state}
                                                $color={line.color}
                                                onClick={() => state !== "locked" && onSelectStep(globalIndex)}
                                                title={step.label}
                                            >
                                                {state === "active" && <StopDot $color={line.color} />}
                                                {step.needsAction && !step.done && <NeedsYouDot />}
                                            </Stop>
                                        </StopCol>
                                    </>
                                );
                            })}
                            {line.id === "author" && (reviewCount ?? 0) > 0 && lineSteps.length > 0 && (
                                <TrailingTrack />
                            )}
                            {line.id === "book" && <TrailingTrack />}
                        </Track>
                    </LineRow>
                );
            })}
        </MapWrap>
    );
}
