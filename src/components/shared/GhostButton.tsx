import styled from "styled-components/macro";

export const GhostButton = styled.button`
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
