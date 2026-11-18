import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RANGE_PRESETS,
  DatePicker,
  DateRangePicker,
  formatPickerRange,
  nextRange,
  parseIsoDate,
  toIsoDate,
  type IsoDateRange,
} from "@tobacco/ui";

afterEach(cleanup);
// the first popover render in a cold jsdom is slow; keep the default (5s) for logic, widen for interaction tests
vi.setConfig({ testTimeout: 30_000 });

const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`)!;

describe("calendar date helpers", () => {
  it("round-trips a calendar date without the one-day timezone shift", () => {
    // local midnight: toISOString() would give the PREVIOUS day anywhere east of UTC (e.g. Zimbabwe, UTC+2)
    const local = new Date(2026, 10, 17);
    expect(toIsoDate(local)).toBe("2026-11-17");
    const parsed = parseIsoDate("2026-11-17")!;
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual([2026, 10, 17]);
    expect(toIsoDate(parsed)).toBe("2026-11-17");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseIsoDate("")).toBeUndefined();
    expect(parseIsoDate("17/11/2026")).toBeUndefined();
    expect(parseIsoDate("2026-02-31")).toBeUndefined();
    expect(parseIsoDate("2026-13-01")).toBeUndefined();
  });

  it("two-click range logic: start, complete, swap when the end is earlier, restart after a complete range", () => {
    expect(nextRange({}, "2026-11-10")).toEqual({ from: "2026-11-10" });
    expect(nextRange({ from: "2026-11-10" }, "2026-11-14")).toEqual({ from: "2026-11-10", to: "2026-11-14" });
    expect(nextRange({ from: "2026-11-10" }, "2026-11-04")).toEqual({ from: "2026-11-04", to: "2026-11-10" });
    expect(nextRange({ from: "2026-11-10" }, "2026-11-10")).toEqual({ from: "2026-11-10", to: "2026-11-10" });
    expect(nextRange({ from: "2026-11-10", to: "2026-11-14" }, "2026-11-20")).toEqual({ from: "2026-11-20" });
  });

  it("summarises ranges for the trigger", () => {
    expect(formatPickerRange({})).toBe("Any date");
    expect(formatPickerRange({ from: "2026-11-03", to: "2026-11-17" })).toBe("3 Nov 2026 – 17 Nov 2026");
    expect(formatPickerRange({ from: "2026-11-03", to: "2026-11-03" })).toBe("3 Nov 2026");
    expect(formatPickerRange({ from: "2026-11-03" })).toBe("From 3 Nov 2026");
  });

  it("presets resolve to the expected local dates", () => {
    const today = new Date(2026, 10, 17); // Tuesday 17 Nov 2026
    const get = (id: string) => {
      const r = DEFAULT_RANGE_PRESETS.find((p) => p.id === id)!.range(today);
      return [toIsoDate(r.from), toIsoDate(r.to)];
    };
    expect(get("today")).toEqual(["2026-11-17", "2026-11-17"]);
    expect(get("yesterday")).toEqual(["2026-11-16", "2026-11-16"]);
    expect(get("last-7")).toEqual(["2026-11-11", "2026-11-17"]);
    expect(get("last-30")).toEqual(["2026-10-19", "2026-11-17"]);
    expect(get("this-month")).toEqual(["2026-11-01", "2026-11-17"]);
    expect(get("last-month")).toEqual(["2026-10-01", "2026-10-31"]);
    expect(get("this-year")).toEqual(["2026-01-01", "2026-11-17"]);
    // month boundaries: last month from January is December of the previous year
    const jan = DEFAULT_RANGE_PRESETS.find((p) => p.id === "last-month")!.range(new Date(2027, 0, 15));
    expect([toIsoDate(jan.from), toIsoDate(jan.to)]).toEqual(["2026-12-01", "2026-12-31"]);
  });
});

function RangeHarness({ initial = {}, onChange }: { initial?: IsoDateRange; onChange?: (v: IsoDateRange) => void }) {
  const [value, setValue] = useState<IsoDateRange>(initial);
  return (
    <DateRangePicker
      aria-label="Sale date"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("DateRangePicker", () => {
  it("commits only when both ends are chosen and emits local yyyy-mm-dd strings", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeHarness initial={{ from: "2026-11-03", to: "2026-11-05" }} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^Sale date:/ }));
    await user.click(day("2026-11-10"));
    expect(onChange).not.toHaveBeenCalled(); // first click only starts a new range
    expect(screen.getByText("Now pick the end date")).toBeTruthy();

    await user.click(day("2026-11-14"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ from: "2026-11-10", to: "2026-11-14" });
    expect(screen.getByRole("button", { name: /^Sale date:/ }).textContent).toContain("10 Nov 2026 – 14 Nov 2026");
  });

  it("an earlier second click swaps the ends", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeHarness initial={{ from: "2026-11-03", to: "2026-11-05" }} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^Sale date:/ }));
    await user.click(day("2026-11-20"));
    await user.click(day("2026-11-12"));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-11-12", to: "2026-11-20" });
  });

  it("a preset applies immediately", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeHarness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^Sale date:/ }));
    await user.click(screen.getByTestId("range-preset-today"));
    const today = toIsoDate(new Date());
    expect(onChange).toHaveBeenCalledWith({ from: today, to: today });
  });

  it("can be cleared from the trigger and from the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RangeHarness initial={{ from: "2026-11-03", to: "2026-11-05" }} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Clear Sale date" }));
    expect(onChange).toHaveBeenLastCalledWith({});
    expect(screen.getByRole("button", { name: /^Sale date:/ }).textContent).toContain("Any date");

    // popover Clear
    const again = render(<RangeHarness initial={{ from: "2026-11-03", to: "2026-11-05" }} onChange={onChange} />);
    const trigger = within(again.container).getByRole("button", { name: /^Sale date:/ });
    await user.click(trigger);
    await user.click(screen.getByTestId("range-clear"));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("disables days outside min/max", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker aria-label="Sale date" value={{ from: "2026-11-10" }} onChange={onChange} min="2026-11-05" max="2026-11-20" />);
    await user.click(screen.getByRole("button", { name: /^Sale date:/ }));
    expect(day("2026-11-04").disabled).toBe(true);
    expect(day("2026-11-21").disabled).toBe(true);
    expect(day("2026-11-12").disabled).toBe(false);
  });
});

describe("DatePicker", () => {
  it("emits yyyy-mm-dd and closes; clear emits an empty string", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker aria-label="Dispatch date" value="2026-11-03" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^Dispatch date:/ }));
    await user.click(day("2026-11-17"));
    expect(onChange).toHaveBeenCalledWith("2026-11-17");
    await user.click(screen.getByRole("button", { name: "Clear Dispatch date" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("shows the placeholder when empty", () => {
    render(<DatePicker aria-label="Dispatch date" value="" onChange={() => undefined} placeholder="Choose a day" />);
    expect(screen.getByRole("button", { name: /^Dispatch date:/ }).textContent).toContain("Choose a day");
  });
});
