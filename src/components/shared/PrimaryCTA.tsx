import styled from "styled-components/macro";

export const PrimaryCTA = styled.button<{ $loading?: boolean; $disabled?: boolean }>`
    background: ${p => p.$disabled ? "rgba(245,166,35,0.25)" : p.$loading ? "rgba(245,166,35,0.6)" : "#F5A623"};
    color: ${p => p.$disabled ? "rgba(255,255,255,0.3)" : "#1a0e00"};
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 0;
    width: 100%;
    cursor: ${p => p.$disabled ? "not-allowed" : p.$loading ? "wait" : "pointer"};
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    letter-spacing: 0.02em;
    box-shadow: ${p => p.$disabled ? "none" : "0 4px 20px rgba(245,166,35,0.35)"};
    &:hover:not([disabled]) {
        background: ${p => p.$disabled ? undefined : "#f9b830"};
        box-shadow: ${p => p.$disabled ? "none" : "0 6px 28px rgba(245,166,35,0.5)"};
    }
    &:active { transform: ${p => p.$disabled ? "none" : "scale(0.99)"}; }
`;
