import { createRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BarcodeScannerInput, type ScanController, type ScanOutcome } from "@tobacco/ui";

/** Behaviour of the reusable scanner field that every floor workspace relies on (docs/design/scanner-workspace-guidelines.md). */
const field = () => screen.getByRole("textbox");

describe("BarcodeScannerInput", () => {
  it("auto-focuses and submits on Enter, clears the field and refocuses it", async () => {
    const onScan = vi.fn(async (): Promise<ScanOutcome> => ({ ok: true, message: "Scanned 1 of 3" }));
    render(<BarcodeScannerInput label="Scan ticket" onScan={onScan} />);
    await waitFor(() => expect(field()).toHaveFocus());
    await userEvent.type(field(), "1000001013{Enter}");
    await waitFor(() => expect(onScan).toHaveBeenCalledWith("1000001013"));
    await waitFor(() => expect(field()).toHaveValue(""));
    await waitFor(() => expect(field()).toHaveFocus());
    expect(await screen.findByText("Scanned 1 of 3")).toBeInTheDocument();
  });

  it("does not intercept Tab (so Tab can move between fields) and ignores empty Enter", async () => {
    const onScan = vi.fn();
    render(
      <>
        <BarcodeScannerInput label="Scan" onScan={onScan} />
        <input aria-label="next field" />
      </>,
    );
    const scanner = screen.getByLabelText("Scan");
    scanner.focus();
    await userEvent.keyboard("{Enter}");
    expect(onScan).not.toHaveBeenCalled(); // empty Enter is ignored
    await userEvent.type(scanner, "123");
    await userEvent.tab();
    expect(screen.getByLabelText("next field")).toHaveFocus(); // Tab moves on…
    expect(onScan).not.toHaveBeenCalled(); // …and never submits
  });

  it("queues rapid consecutive scans in order — none are dropped", async () => {
    const seen: string[] = [];
    const onScan = vi.fn(async (v: string): Promise<ScanOutcome> => {
      await new Promise((r) => setTimeout(r, 15));
      seen.push(v);
      return { ok: true };
    });
    render(<BarcodeScannerInput label="Scan" onScan={onScan} />);
    await userEvent.type(field(), "1000001013{Enter}1000001024{Enter}1000001035{Enter}", { delay: 1 });
    await waitFor(() => expect(seen).toEqual(["1000001013", "1000001024", "1000001035"]));
  });

  it("treats a multi-line paste as a burst of scans", async () => {
    const seen: string[] = [];
    render(
      <BarcodeScannerInput
        label="Scan"
        onScan={async (v) => {
          seen.push(v);
          return { ok: true };
        }}
      />,
    );
    field().focus();
    await userEvent.paste("1000001046\n1000001057\n");
    await waitFor(() => expect(seen).toEqual(["1000001046", "1000001057"]));
  });

  it("rejects invalid values before onScan and reports them (onInvalid + visible reason)", async () => {
    const onScan = vi.fn();
    const onInvalid = vi.fn();
    render(<BarcodeScannerInput label="Scan" onScan={onScan} validate={(v) => (v.length === 10 ? null : "Please enter a valid barcode")} onInvalid={onInvalid} />);
    await userEvent.type(field(), "123{Enter}");
    expect(onScan).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith("123", "Please enter a valid barcode");
    expect(await screen.findByText("Please enter a valid barcode")).toBeInTheDocument();
  });

  it("shows a rejected result in the status region (announced politely) with the verbatim message", async () => {
    render(<BarcodeScannerInput label="Scan" onScan={async () => ({ ok: false, message: "Cannot find the bale: 9999999999" })} />);
    await userEvent.type(field(), "9999999999{Enter}");
    const status = await screen.findByTestId("scan-feedback");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Cannot find the bale: 9999999999");
    expect(status.querySelector('[data-result="error"]')).not.toBeNull();
  });

  it("turns a thrown error into a rejected scan instead of crashing the workspace", async () => {
    render(
      <BarcodeScannerInput
        label="Scan"
        onScan={async () => {
          throw new Error("Floor Summary scanning is currently off.");
        }}
      />,
    );
    await userEvent.type(field(), "1000001013{Enter}");
    expect(await screen.findByText(/scanning is currently off/)).toBeInTheDocument();
  });

  it("lets simulate-scan chips inject through the same pipeline via the controller handle", async () => {
    const controller = createRef<ScanController>();
    const onScan = vi.fn(async (): Promise<ScanOutcome> => ({ ok: true, message: "Bale added" }));
    render(<BarcodeScannerInput label="Scan" onScan={onScan} controllerRef={controller} />);
    act(() => controller.current?.scan("1000001035"));
    await waitFor(() => expect(onScan).toHaveBeenCalledWith("1000001035"));
    expect(await screen.findByText("Bale added")).toBeInTheDocument();
  });

  it("can be disabled (e.g. scanning switched off for the floor)", () => {
    render(<BarcodeScannerInput label="Scan" disabled onScan={vi.fn()} />);
    expect(field()).toBeDisabled();
  });
});
