import styled, { css } from "styled-components/macro";

export interface WizardProgressStep {
    id: string;
    label: string;
    done?: boolean;
}

export interface ProgressBarProps {
    steps: WizardProgressStep[];
    activeId: string;
    color?: "amber" | "blue";
    rowLabel?: string;
    colCount?: number;
}

const PALETTE = {
    amber: {
        primary:      "#F5A623",
        doneBg:       "rgba(245,166,35,0.25)",
        doneBorder:   "#F5A623",
        activeBg:     "rgba(245,166,35,0.15)",
        activeBorder: "rgba(245,166,35,0.7)",
        activeGlow:   "rgba(245,166,35,0.3)",
        lineActive:   "rgba(245,166,35,0.6)",
        labelActive:  "#F5A623",
        labelDone:    "rgba(245,166,35,0.5)",
    },
    blue: {
        primary:      "#60a5fa",
        doneBg:       "rgba(96,165,250,0.2)",
        doneBorder:   "#60a5fa",
        activeBg:     "rgba(96,165,250,0.12)",
        activeBorder: "rgba(96,165,250,0.7)",
        activeGlow:   "rgba(96,165,250,0.3)",
        lineActive:   "rgba(96,165,250,0.5)",
        labelActive:  "#60a5fa",
        labelDone:    "rgba(96,165,250,0.45)",
    },
};

type Palette = typeof PALETTE["amber"];

const Bar = styled.div`
    display: flex;
    align-items: center;
    padding: 14px 22px 0;
    gap: 0;
`;

const RowLabel = styled.div`
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.25);
    width: 46px;
    flex-shrink: 0;
    padding-bottom: 16px;
`;

const Step = styled.div<{ $active: boolean; $done: boolean; $p: Palette; $colCount?: number }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    ${p => p.$colCount ? `flex: 0 0 calc(100% / ${p.$colCount}); min-width: 0;` : "flex: 1;"}
    position: relative;

    &:not(:last-child)::after {
        content: "";
        position: absolute;
        top: 10px;
        left: calc(50% + 10px);
        width: calc(100% - 20px);
        height: 1px;
        background: ${p => p.$done ? p.$p.lineActive : "rgba(255,255,255,0.1)"};
        transition: background 0.3s;
    }
`;

const Dot = styled.div<{ $active: boolean; $done: boolean; $p: Palette }>`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    position: relative;
    z-index: 1;
    transition: all 0.2s;

    ${p => p.$done && css`
        background: ${p.$p.doneBg};
        border: 1.5px solid ${p.$p.doneBorder};
        color: ${p.$p.primary};
    `}
    ${p => p.$active && !p.$done && css`
        background: ${p.$p.activeBg};
        border: 1.5px solid ${p.$p.activeBorder};
        color: ${p.$p.primary};
        box-shadow: 0 0 10px ${p.$p.activeGlow};
    `}
    ${p => !p.$active && !p.$done && css`
        background: rgba(255,255,255,0.04);
        border: 1.5px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.25);
    `}
`;

const Label = styled.div<{ $active: boolean; $done: boolean; $p: Palette }>`
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    color: ${p => p.$active ? p.$p.labelActive : p.$done ? p.$p.labelDone : "rgba(255,255,255,0.2)"};
    transition: color 0.2s;
`;

export function ProgressBar({ steps, activeId, color = "amber", rowLabel, colCount }: ProgressBarProps) {
    const palette   = PALETTE[color];
    const activeIdx = steps.findIndex(s => s.id === activeId);

    return (
        <Bar>
            {rowLabel && <RowLabel>{rowLabel}</RowLabel>}
            {steps.map((s, i) => {
                const isActive = s.id === activeId;
                const isDone   = s.done !== undefined ? s.done : i < activeIdx;
                return (
                    <Step key={s.id} $active={isActive} $done={isDone} $p={palette} $colCount={colCount}>
                        <Dot $active={isActive} $done={isDone} $p={palette}>
                            {isDone ? "✓" : i + 1}
                        </Dot>
                        <Label $active={isActive} $done={isDone} $p={palette}>
                            {s.label}
                        </Label>
                    </Step>
                );
            })}
        </Bar>
    );
}
