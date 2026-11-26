import { render, screen } from "@testing-library/react";
import RunProgress from "./RunProgress";

const items = [
  { id: "Steady hand", label: "Steady hand" },
  { id: "Slow tremor", label: "Slow tremor" },
];
const job = (itemId, copy, status, extra = {}) => ({ key: `${itemId} #${copy}`, itemId, label: itemId, copy, status, ...extra });

describe("RunProgress", () => {
  it("shows every copy's state while a batch runs", () => {
    const since = new Date(Date.now() - 34_000).toISOString();
    render(
      <RunProgress
        source="api"
        active={{ label: "hi", status: "running", createdAt: new Date(Date.now() - 50_000).toISOString() }}
        items={items}
        jobs={[
          job("Steady hand", 1, "done"),
          job("Steady hand", 2, "running", { since }),
          job("Slow tremor", 1, "queued"),
          job("Slow tremor", 2, "failed", { error: "boom" }),
        ]}
      />
    );
    expect(screen.getByText("Batch “hi” · on the server")).toBeInTheDocument();
    // The status badge and the "Running" count chip.
    expect(screen.getAllByText("Running")).toHaveLength(2);
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    expect(screen.getByText(/1\/2 done · 1 running \(0:3\d\)/)).toBeInTheDocument();
    expect(screen.getByTitle("Copy 2: Failed (boom)")).toBeInTheDocument();
    expect(screen.getByText(/up to 20 run at once/)).toBeInTheDocument();
  });

  it("says when the batch is finished", () => {
    render(
      <RunProgress
        source="api"
        active={{ label: "hi", status: "completed", createdAt: "2026-11-26T17:00:00Z", finishedAt: "2026-11-26T17:01:30Z" }}
        items={items.slice(0, 1)}
        jobs={[job("Steady hand", 1, "done")]}
      />
    );
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("shows something straight after sending, before the first update", () => {
    render(<RunProgress source="api" active={{ label: "hi", status: "running" }} items={[]} jobs={[]} />);
    expect(screen.getByText("Connecting to batch “hi”…")).toBeInTheDocument();
  });
});
