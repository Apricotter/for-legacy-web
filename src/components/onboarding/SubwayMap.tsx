import styled from "styled-components/macro";
import { WizardStep } from "./useOnboardingMessages";

// ── styled ────────────────────────────────────────────────────────────────────

const MapWrap = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 20px 12px;
    background: var(--secondary-background);
    border-bottom: 1px solid var(--tertiary-background);
`;

const LineRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0;
`;

const LineLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--tertiary-foreground);
    text-transform: uppercase;
    width: 62px;
    flex-shrink: 0;
`;

const Track = styled.div`
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
`;

const Segment = styled.div<{ $done: boolean; $color: string }>`
    flex: 1;
    height: 2px;
    background: ${p => p.$done ? p.$color : "var(--tertiary-background)"};
    transition: background 0.3s;
`;

const Stop = styled.button<{ $state: "done" | "active" | "pending" | "locked"; $color: string }>`
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid ${p =>
        p.$state === "done"    ? p.$color :
        p.$state === "active"  ? p.$color :
        p.$state === "pending" ? p.$color :
        "var(--tertiary-background)"
    };
    background: ${p =>
        p.$state === "done"   ? p.$color :
        p.$state === "active" ? "var(--background)" :
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

    &:focus-visible {
        box-shadow: 0 0 0 2px var(--accent);
    }
`;

const StopDot = styled.div<{ $color: string }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${p => p.$color};
`;

const StopLabel = styled.div<{ $active: boolean; $color: string }>`
    position: absolute;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    font-weight: ${p => p.$active ? "700" : "500"};
    color: ${p => p.$active ? p.$color : "var(--tertiary-foreground)"};
    white-space: nowrap;
    pointer-events: none;
`;

const NeedsYouDot = styled.div`
    position: absolute;
    top: -3px;
    right: -3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f87171;
    border: 1px solid var(--secondary-background);
`;

// ── types ─────────────────────────────────────────────────────────────────────

interface SubwayMapProps {
    steps: WizardStep[];
    activeIndex: number;
    onSelectStep: (index: number) => void;
}

interface LineConfig {
    id: "book" | "author";
    label: string;
    color: string;
}

const LINES: LineConfig[] = [
    { id: "book",   label: "BOOK",   color: "#F4B978" },
    { id: "author", label: "AUTHOR", color: "#60a5fa" },
];

// ── component ─────────────────────────────────────────────────────────────────

export default function SubwayMap({ steps, activeIndex, onSelectStep }: SubwayMapProps) {
    return (
        <MapWrap>
            {LINES.map(line => {
                const lineSteps = steps
                    .map((s, i) => ({ step: s, globalIndex: i }))
                    .filter(({ step }) => step.line === line.id);

                if (lineSteps.length === 0) return null;

                return (
                    <LineRow key={line.id}>
                        <LineLabel>{line.label}</LineLabel>
                        <Track>
                            {lineSteps.map(({ step, globalIndex }, pos) => {
                                const isFirst = pos === 0;
                                const prevDone = pos === 0 || lineSteps[pos - 1].step.done;

                                const state =
                                    step.done            ? "done"    :
                                    globalIndex === activeIndex ? "active"  :
                                    step.needsAction     ? "pending" :
                                    "locked";

                                return (
                                    <>
                                        {!isFirst && (
                                            <Segment
                                                $done={lineSteps[pos - 1].step.done}
                                                $color={line.color}
                                            />
                                        )}
                                        <Stop
                                            key={step.id}
                                            $state={state}
                                            $color={line.color}
                                            onClick={() => state !== "locked" && onSelectStep(globalIndex)}
                                            title={step.label}
                                        >
                                            {state === "done" && null}
                                            {state === "active" && <StopDot $color={line.color} />}
                                            {step.needsAction && !step.done && <NeedsYouDot />}
                                            <StopLabel $active={globalIndex === activeIndex} $color={line.color}>
                                                {step.label}
                                            </StopLabel>
                                        </Stop>
                                    </>
                                );
                            })}
                            <Segment $done={false} $color={line.color} style={{ flex: 2 }} />
                        </Track>
                    </LineRow>
                );
            })}
        </MapWrap>
    );
}
