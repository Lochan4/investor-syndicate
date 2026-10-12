import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";

describe("Sidebar", () => {
  it("renders dashboard and investments links for investor", () => {
    render(<Sidebar role="investor" />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /investments/i })).toBeInTheDocument();
  });

  it("renders admin link for super_admin", () => {
    render(<Sidebar role="super_admin" />);
    expect(screen.getByRole("link", { name: /flow template/i })).toBeInTheDocument();
  });

  it("hides admin link for investor", () => {
    render(<Sidebar role="investor" />);
    expect(screen.queryByRole("link", { name: /flow template/i })).not.toBeInTheDocument();
  });

  it("hides admin link for developer", () => {
    render(<Sidebar role="developer" />);
    expect(screen.queryByRole("link", { name: /flow template/i })).not.toBeInTheDocument();
  });
});
