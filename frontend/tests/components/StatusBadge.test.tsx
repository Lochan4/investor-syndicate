import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";

const ALL_STATUSES = [
  "draft",
  "building_graph",
  "open",
  "consensus",
  "rebuttals",
  "final",
] as const;

describe("StatusBadge", () => {
  it.each(ALL_STATUSES)("renders '%s' without crashing", (status) => {
    render(<StatusBadge status={status} />);
    // Each status must produce a visible, non-empty label
    const badge = screen.getByTestId("status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).not.toBe("");
  });

  it("does not render 'undefined' or 'null' as text", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });
});
