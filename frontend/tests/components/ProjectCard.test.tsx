import { render, screen } from "@testing-library/react";
import { ProjectCard } from "@/components/ProjectCard";

const mockProject = {
  id: "proj-123",
  startup_name: "TestStartup",
  status: "open" as const,
  sector: "fintech",
  stage: "seed",
  created_at: "2026-10-04T10:00:00Z",
  member_count: 4,
};

describe("ProjectCard", () => {
  it("renders startup name", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("TestStartup")).toBeInTheDocument();
  });

  it("renders a StatusBadge", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
  });

  it("renders member count", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });

  it("renders formatted created_at date", () => {
    render(<ProjectCard project={mockProject} />);
    // Date should appear in some human-readable form — not raw ISO string
    expect(screen.queryByText("2026-10-04T10:00:00Z")).not.toBeInTheDocument();
  });

  it("links to the project hub", () => {
    render(<ProjectCard project={mockProject} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("proj-123"));
  });
});
