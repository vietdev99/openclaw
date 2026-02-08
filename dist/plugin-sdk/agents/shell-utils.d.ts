export declare function getShellConfig(): {
    shell: string;
    args: string[];
};
/**
 * Collapse carriage return sequences to simulate terminal behavior.
 * Progress bars like "0%\r1%\r2%\r...100%\r" become just "100%".
 * This prevents wasting tokens on intermediate progress states.
 */
export declare function collapseCarriageReturns(text: string): string;
export declare function sanitizeBinaryOutput(text: string): string;
export declare function killProcessTree(pid: number): void;
