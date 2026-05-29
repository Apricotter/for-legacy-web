import styled from "styled-components/macro";

export const InputLabel = styled.label`
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
    text-transform: uppercase;
    letter-spacing: 0.07em;
`;

export const InputField = styled.input<{ $compact?: boolean }>`
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.92);
    font-size: ${p => p.$compact ? "12px" : "14px"};
    font-family: inherit;
    padding: ${p => p.$compact ? "7px 12px" : "9px 13px"};
    outline: none;
    transition: border-color 0.15s;
    &::placeholder { color: rgba(255,255,255,0.28); }
    &:focus { border-color: rgba(245,166,35,0.6); }
`;
